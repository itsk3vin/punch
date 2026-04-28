package middleware

import (
	"net/http"
	"os"
	"strings"
)

func CORS() Middleware {
	allowedOrigins := parseAllowedOrigins(os.Getenv("CORS_ORIGIN"))

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if origin := allowedOrigin(r.Header.Get("Origin"), allowedOrigins); origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func parseAllowedOrigins(value string) map[string]struct{} {
	if value == "" {
		value = "*"
	}

	origins := make(map[string]struct{})
	for _, origin := range strings.Split(value, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins[origin] = struct{}{}
		}
	}

	return origins
}

func allowedOrigin(requestOrigin string, allowedOrigins map[string]struct{}) string {
	if _, ok := allowedOrigins["*"]; ok {
		return "*"
	}

	if requestOrigin == "" {
		return ""
	}

	if _, ok := allowedOrigins[requestOrigin]; ok {
		return requestOrigin
	}

	return ""
}
