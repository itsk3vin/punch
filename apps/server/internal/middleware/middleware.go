package middleware

import "net/http"

type Middleware func(http.Handler) http.Handler

// Chain applies middlewares in left-to-right order (outermost first).
func Chain(h http.Handler, ms ...Middleware) http.Handler {
	for i := len(ms) - 1; i >= 0; i-- {
		h = ms[i](h)
	}
	return h
}
