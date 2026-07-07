package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dennislapchenko/gaias-choice/backend/internal/auth"
	"github.com/dennislapchenko/gaias-choice/backend/internal/store"
)

// userKey is where the session middleware parks the authenticated user on
// the gin context. A plain string on purpose: gin.Context.Value only
// consults its Keys map for string keys, and that's how handlers (which
// receive the gin context as a context.Context) read it back.
const userKey = "gc.sessionUser"

// sessionAuth enforces the spec's security declarations. The generated
// wrapper (gen.go) calls c.Set(SessionScopes, …) for exactly the operations
// openapi.yaml marks `security: session` — so this middleware needs no route
// list of its own: no scopes on the context ⇒ public operation, pass through;
// scopes present ⇒ a valid bearer session is required and its user is parked
// on the context.
func sessionAuth(a *auth.Service) MiddlewareFunc {
	return func(c *gin.Context) {
		if _, secured := c.Get(string(SessionScopes)); !secured {
			return
		}
		user, ok := a.Validate(bearerToken(c))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, Error{Error: "unauthorized"})
			return
		}
		c.Set(userKey, user)
	}
}

func bearerToken(c *gin.Context) string {
	return strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
}

// ginContext unwraps the context.Context the strict handlers receive back
// into the *gin.Context it actually is (see gen.go's strictHandler).
func ginContext(ctx context.Context) *gin.Context {
	c, _ := ctx.(*gin.Context)
	return c
}

// sessionUser reads the user sessionAuth parked on the context.
func sessionUser(ctx context.Context) (store.User, bool) {
	c := ginContext(ctx)
	if c == nil {
		return store.User{}, false
	}
	v, exists := c.Get(userKey)
	if !exists {
		return store.User{}, false
	}
	u, ok := v.(store.User)
	return u, ok
}
