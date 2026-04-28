package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

type claimsContextKey struct{}

type Auth0 struct {
	verifier *oidc.IDTokenVerifier
}

func NewAuth0(ctx context.Context) (*Auth0, error) {
	domain := os.Getenv("AUTH0_DOMAIN")
	audience := os.Getenv("AUTH0_AUDIENCE")
	if domain == "" || audience == "" {
		return nil, fmt.Errorf("AUTH0_DOMAIN and AUTH0_AUDIENCE must be set")
	}

	issuer := auth0Issuer(domain)
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("create Auth0 provider: %w", err)
	}

	return &Auth0{
		verifier: provider.Verifier(&oidc.Config{ClientID: audience}),
	}, nil
}

func (a *Auth0) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r.Header.Get("Authorization"))
		if !ok {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}

		idToken, err := a.verifier.Verify(r.Context(), token)
		if err != nil {
			http.Error(w, "invalid bearer token", http.StatusUnauthorized)
			return
		}

		var claims map[string]any
		if err := idToken.Claims(&claims); err != nil {
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), claimsContextKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func Claims(ctx context.Context) map[string]any {
	claims, _ := ctx.Value(claimsContextKey{}).(map[string]any)
	return claims
}

func bearerToken(header string) (string, bool) {
	prefix := "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return "", false
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	return token, token != ""
}

func auth0Issuer(domain string) string {
	domain = strings.TrimSpace(domain)
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")
	return "https://" + domain + "/"
}
