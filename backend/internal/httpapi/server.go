// Package httpapi is the HTTP layer: the gin router, the middlewares, and
// the handlers implementing the OpenAPI contract. gen.go is generated from
// ../../openapi.yaml (`task be:gen`) — endpoints are born in the spec, and
// server here must implement whatever StrictServerInterface demands.
package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/dennislapchenko/gaias-choice/backend/internal/auth"
	"github.com/dennislapchenko/gaias-choice/backend/internal/content"
	"github.com/dennislapchenko/gaias-choice/backend/internal/mail"
	"github.com/dennislapchenko/gaias-choice/backend/internal/store"
)

// Deps is everything the HTTP layer needs, wired explicitly by main.go.
type Deps struct {
	CORSOrigins []string
	Store       *store.Store
	Auth        *auth.Service
	Content     content.Store // nil ⇒ content routes answer 503
	Mailer      *mail.Mailer  // nil ⇒ /auth/magic answers 503
	SiteURL     string        // where emailed magic links point (no trailing /)
}

// NewRouter builds the fully-wired gin engine: logging, recovery, CORS, a
// global request-body cap, and the generated routes under /api with
// spec-driven session enforcement.
func NewRouter(d Deps) *gin.Engine {
	r := gin.New()
	// Only the compose-network reverse proxy (Caddy) may set X-Forwarded-For;
	// otherwise a client could spoof its IP past the login rate limit.
	_ = r.SetTrustedProxies([]string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"})
	r.Use(gin.Logger(), gin.Recovery(), corsMiddleware(d.CORSOrigins))
	// One global body cap (content cap + JSON envelope headroom) — nothing
	// this API accepts is legitimately bigger.
	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, content.MaxBytes+128*1024)
	})

	srv := &server{
		store:        d.Store,
		auth:         d.Auth,
		content:      d.Content,
		mailer:       d.Mailer,
		siteURL:      d.SiteURL,
		loginLimiter: newRateLimiter(10, time.Minute),
		// Registration is open to the world; a tighter lid keeps a bot from
		// filling the campfire with junk accounts.
		registerLimiter: newRateLimiter(10, time.Hour),
		// Each magic request sends a real email — same lid as registration.
		magicLimiter: newRateLimiter(10, time.Hour),
	}
	RegisterHandlersWithOptions(r, NewStrictHandler(srv, nil), GinServerOptions{
		BaseURL:     "/api",
		Middlewares: []MiddlewareFunc{sessionAuth(d.Auth)},
		ErrorHandler: func(c *gin.Context, err error, status int) {
			c.JSON(status, Error{Error: err.Error()})
		},
	})
	return r
}

type server struct {
	store           *store.Store
	auth            *auth.Service
	content         content.Store
	mailer          *mail.Mailer
	siteURL         string
	loginLimiter    *rateLimiter
	registerLimiter *rateLimiter
	magicLimiter    *rateLimiter
}

// Compile-time proof the contract is fully implemented.
var _ StrictServerInterface = (*server)(nil)

// --- system --------------------------------------------------------------------

func (s *server) GetHealth(context.Context, GetHealthRequestObject) (GetHealthResponseObject, error) {
	return GetHealth200JSONResponse{Status: "ok"}, nil
}

func (s *server) GetHello(context.Context, GetHelloRequestObject) (GetHelloResponseObject, error) {
	n, err := s.store.Bump()
	if err != nil {
		return GetHello500JSONResponse{InternalJSONResponse{Error: "db"}}, nil
	}
	return GetHello200JSONResponse{
		Message: "Hello from the Gaia's Choice backend.",
		Hits:    n,
	}, nil
}

// --- auth ----------------------------------------------------------------------

func (s *server) Login(ctx context.Context, req LoginRequestObject) (LoginResponseObject, error) {
	if c := ginContext(ctx); c != nil && !s.loginLimiter.allow(c.ClientIP()) {
		return Login429JSONResponse{RateLimitedJSONResponse{Error: "too many attempts — try again later"}}, nil
	}
	if req.Body == nil || req.Body.Email == "" || req.Body.Password == "" {
		return Login400JSONResponse{BadRequestJSONResponse{Error: "email and password required"}}, nil
	}
	sess, err := s.auth.Login(req.Body.Email, req.Body.Password)
	if errors.Is(err, auth.ErrBadCredentials) {
		return Login401JSONResponse{UnauthorizedJSONResponse{Error: "bad credentials"}}, nil
	}
	if err != nil {
		return nil, err // infrastructure — generated code answers 500
	}
	return Login200JSONResponse(grant(sess)), nil
}

func (s *server) Register(ctx context.Context, req RegisterRequestObject) (RegisterResponseObject, error) {
	if c := ginContext(ctx); c != nil && !s.registerLimiter.allow(c.ClientIP()) {
		return Register429JSONResponse{RateLimitedJSONResponse{Error: "too many attempts — try again later"}}, nil
	}
	if req.Body == nil || req.Body.Email == "" || req.Body.Password == "" || req.Body.DisplayName == "" {
		return Register400JSONResponse{BadRequestJSONResponse{Error: "email, password and display name required"}}, nil
	}
	sess, err := s.auth.Register(req.Body.Email, req.Body.Password, req.Body.DisplayName)
	switch {
	case errors.Is(err, auth.ErrEmailTaken):
		return Register409JSONResponse(Error{Error: "email already registered"}), nil
	case errors.Is(err, auth.ErrInvalid):
		return Register400JSONResponse{BadRequestJSONResponse{Error: err.Error()}}, nil
	case err != nil:
		return nil, err
	}
	return Register200JSONResponse(grant(sess)), nil
}

func (s *server) RequestMagicLink(ctx context.Context, req RequestMagicLinkRequestObject) (RequestMagicLinkResponseObject, error) {
	if s.mailer == nil {
		return RequestMagicLink503JSONResponse(Error{Error: "sign-in links not configured"}), nil
	}
	if c := ginContext(ctx); c != nil && !s.magicLimiter.allow(c.ClientIP()) {
		return RequestMagicLink429JSONResponse{RateLimitedJSONResponse{Error: "too many attempts — try again later"}}, nil
	}
	if req.Body == nil || req.Body.Email == "" {
		return RequestMagicLink400JSONResponse{BadRequestJSONResponse{Error: "email required"}}, nil
	}
	token, err := s.auth.RequestMagic(req.Body.Email)
	if errors.Is(err, auth.ErrInvalid) {
		return RequestMagicLink400JSONResponse{BadRequestJSONResponse{Error: "not an email address"}}, nil
	}
	if err != nil {
		return nil, err
	}
	locale := ""
	if req.Body.Locale != nil {
		locale = *req.Body.Locale
	}
	subject, body := magicEmail(locale, s.siteURL+"/#magic="+token)
	// Send failure is an ops problem (bad SMTP config, provider down), not
	// the user's: log it, keep the answer uniform.
	if err := s.mailer.Send(strings.TrimSpace(req.Body.Email), subject, body); err != nil {
		log.Printf("mail: magic-link send failed: %v", err)
	}
	return RequestMagicLink200JSONResponse{Status: "sent"}, nil
}

func (s *server) VerifyMagicLink(ctx context.Context, req VerifyMagicLinkRequestObject) (VerifyMagicLinkResponseObject, error) {
	if c := ginContext(ctx); c != nil && !s.loginLimiter.allow(c.ClientIP()) {
		return VerifyMagicLink429JSONResponse{RateLimitedJSONResponse{Error: "too many attempts — try again later"}}, nil
	}
	if req.Body == nil || req.Body.Token == "" {
		return VerifyMagicLink400JSONResponse{BadRequestJSONResponse{Error: "token required"}}, nil
	}
	sess, err := s.auth.VerifyMagic(req.Body.Token)
	if errors.Is(err, auth.ErrBadCredentials) {
		return VerifyMagicLink401JSONResponse(Error{Error: "link invalid, expired, or already used"}), nil
	}
	if err != nil {
		return nil, err
	}
	return VerifyMagicLink200JSONResponse(grant(sess)), nil
}

// magicEmail is the whole email-template system: two locales, plain text.
func magicEmail(locale, link string) (subject, body string) {
	if strings.HasPrefix(locale, "ru") {
		return "Вход на Gaia's Choice",
			"Здравствуйте!\n\nЧтобы войти, откройте ссылку:\n\n" + link +
				"\n\nОна сработает один раз и действует 15 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.\n\n— Gaia's Choice"
	}
	return "Sign in to Gaia's Choice",
		"Hello!\n\nOpen this link to sign in:\n\n" + link +
			"\n\nIt works once and expires in 15 minutes. If you didn't request it, just ignore this email.\n\n— Gaia's Choice"
}

// grant maps an issued session onto the shared login/register response body.
func grant(sess auth.Session) SessionGrant {
	return SessionGrant{
		Token:       sess.Token,
		Role:        Role(sess.User.Role),
		DisplayName: auth.DisplayName(sess.User),
		ExpiresAt:   sess.ExpiresAt,
	}
}

func (s *server) Logout(ctx context.Context, _ LogoutRequestObject) (LogoutResponseObject, error) {
	if c := ginContext(ctx); c != nil {
		s.auth.Logout(bearerToken(c))
	}
	return Logout204Response{}, nil
}

func (s *server) GetMe(ctx context.Context, _ GetMeRequestObject) (GetMeResponseObject, error) {
	u, ok := sessionUser(ctx)
	if !ok { // unreachable behind sessionAuth; belt and braces
		return GetMe401JSONResponse{UnauthorizedJSONResponse{Error: "unauthorized"}}, nil
	}
	return GetMe200JSONResponse(meResponse(s, u)), nil
}

// meResponse is the shared GetMe/UpdateMe body.
func meResponse(s *server, u store.User) MeResponse {
	return MeResponse{
		Email:       u.Email,
		Role:        Role(u.Role),
		DisplayName: auth.DisplayName(u),
		AvatarUrl:   u.AvatarURL,
		// Edit chrome needs both a configured storage backend and a role
		// that the content endpoints will actually let through.
		Editing: s.content != nil && u.CanEdit(),
	}
}

func (s *server) UpdateMe(ctx context.Context, req UpdateMeRequestObject) (UpdateMeResponseObject, error) {
	caller, ok := sessionUser(ctx)
	if !ok { // unreachable behind sessionAuth; belt and braces
		return UpdateMe401JSONResponse{UnauthorizedJSONResponse{Error: "unauthorized"}}, nil
	}
	if req.Body == nil || req.Body.DisplayName == "" || req.Body.Email == "" {
		return UpdateMe400JSONResponse{BadRequestJSONResponse{Error: "display name and email required"}}, nil
	}
	avatarURL := ""
	if req.Body.AvatarUrl != nil {
		avatarURL = *req.Body.AvatarUrl
	}
	password := ""
	if req.Body.Password != nil {
		password = *req.Body.Password
	}
	updated, err := s.auth.UpdateProfile(caller.ID, req.Body.DisplayName, req.Body.Email, avatarURL, password)
	switch {
	case errors.Is(err, auth.ErrEmailTaken):
		return UpdateMe409JSONResponse(Error{Error: "email already registered"}), nil
	case errors.Is(err, auth.ErrInvalid):
		return UpdateMe400JSONResponse{BadRequestJSONResponse{Error: err.Error()}}, nil
	case err != nil:
		return nil, err
	}
	return UpdateMe200JSONResponse(meResponse(s, updated)), nil
}

func (s *server) ListUsers(ctx context.Context, _ ListUsersRequestObject) (ListUsersResponseObject, error) {
	caller, ok := sessionUser(ctx)
	if !ok { // unreachable behind sessionAuth; belt and braces
		return ListUsers401JSONResponse{UnauthorizedJSONResponse{Error: "unauthorized"}}, nil
	}
	members, err := s.store.ListMembers()
	if err != nil {
		return nil, err
	}
	resp := ListUsers200JSONResponse{}
	for _, m := range members {
		name := m.DisplayName
		if name == "" { // pre-003 account
			name = auth.DisplayName(store.User{Email: m.Email})
		}
		resp.Users = append(resp.Users, struct {
			AvatarUrl   *string            `json:"avatarUrl,omitempty"`
			DisplayName string             `json:"displayName"`
			JoinedAt    openapi_types.Date `json:"joinedAt"`
			Role        Role               `json:"role"`
			You         bool               `json:"you"`
		}{
			AvatarUrl:   &m.AvatarURL,
			DisplayName: name,
			JoinedAt:    openapi_types.Date{Time: m.CreatedAt},
			Role:        Role(m.Role),
			You:         m.ID == caller.ID,
		})
	}
	return resp, nil
}

// --- content -------------------------------------------------------------------

func (s *server) GetContentFile(_ context.Context, req GetContentFileRequestObject) (GetContentFileResponseObject, error) {
	if s.content == nil {
		return GetContentFile503JSONResponse{NotConfiguredJSONResponse{Error: "editing not configured"}}, nil
	}
	p := req.Params.Path
	if !content.ValidPath(p) {
		return GetContentFile400JSONResponse{BadRequestJSONResponse{Error: "invalid path"}}, nil
	}
	res, err := s.content.Get(p)
	if err != nil {
		return GetContentFile502JSONResponse{UpstreamJSONResponse{Error: err.Error()}}, nil
	}
	if res.NotFound {
		return GetContentFile404JSONResponse(Error{Error: "not found"}), nil
	}
	return GetContentFile200JSONResponse{Path: p, Sha: res.SHA, Content: res.Content}, nil
}

func (s *server) SaveContent(_ context.Context, req SaveContentRequestObject) (SaveContentResponseObject, error) {
	if s.content == nil {
		return SaveContent503JSONResponse{NotConfiguredJSONResponse{Error: "editing not configured"}}, nil
	}
	if req.Body == nil {
		return SaveContent400JSONResponse{BadRequestJSONResponse{Error: "bad request body"}}, nil
	}
	b := req.Body
	if !content.ValidPath(b.Path) {
		return SaveContent400JSONResponse{BadRequestJSONResponse{Error: "invalid path"}}, nil
	}
	if len(b.Content) == 0 || len(b.Content) > content.MaxBytes {
		return SaveContent413JSONResponse(Error{Error: "content empty or too large"}), nil
	}
	msg := ""
	if b.Message != nil {
		msg = *b.Message
	}
	if msg == "" {
		msg = fmt.Sprintf("content: edit %s via portal", b.Path)
	}
	if len(msg) > 200 {
		msg = msg[:200]
	}
	sha := ""
	if b.Sha != nil {
		sha = *b.Sha
	}
	res, err := s.content.Save(b.Path, b.Content, sha, msg)
	if err != nil {
		return SaveContent502JSONResponse{UpstreamJSONResponse{Error: err.Error()}}, nil
	}
	if res.Conflict {
		return SaveContent409JSONResponse(Error{Error: "conflict — file changed"}), nil
	}
	return SaveContent200JSONResponse{Path: b.Path, Sha: res.SHA, Commit: res.Commit}, nil
}
