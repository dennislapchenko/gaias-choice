// Package httpapi is the HTTP layer: the gin router, the middlewares, and
// the handlers implementing the OpenAPI contract. gen.go is generated from
// ../../openapi.yaml (`task be:gen`) — endpoints are born in the spec, and
// server here must implement whatever StrictServerInterface demands.
package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/dennislapchenko/gaias-choice/backend/internal/auth"
	"github.com/dennislapchenko/gaias-choice/backend/internal/content"
	"github.com/dennislapchenko/gaias-choice/backend/internal/store"
)

// Deps is everything the HTTP layer needs, wired explicitly by main.go.
type Deps struct {
	CORSOrigins []string
	Store       *store.Store
	Auth        *auth.Service
	Content     content.Store // nil ⇒ content routes answer 503
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
		loginLimiter: newRateLimiter(10, time.Minute),
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
	store        *store.Store
	auth         *auth.Service
	content      content.Store
	loginLimiter *rateLimiter
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
		return Login429JSONResponse(Error{Error: "too many attempts — try again later"}), nil
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
	return Login200JSONResponse{
		Token:     sess.Token,
		Role:      Role(sess.User.Role),
		ExpiresAt: sess.ExpiresAt,
	}, nil
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
	return GetMe200JSONResponse{
		Email:   u.Email,
		Role:    Role(u.Role),
		Editing: s.content != nil,
	}, nil
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
