package auth

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func GetJWTSecret() []byte {
	return jwtSecret
}

func init() {
	if len(jwtSecret) == 0 {
		jwtSecret = []byte("default_secret_change_me")
	}
}

type JwtCustomClaims struct {
	UserID         uint   `json:"user_id,omitempty"`
	DisplayID      uint   `json:"display_id,omitempty"`
	Email          string `json:"email,omitempty"`
	Role           string `json:"role,omitempty"`
	OrganizationID uint   `json:"organization_id"`
	jwt.RegisteredClaims
}

func GenerateToken(userID uint, email string, role string, orgID uint) (string, error) {
	claims := &JwtCustomClaims{
		UserID:         userID,
		Email:          email,
		Role:           role,
		OrganizationID: orgID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * 72)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func GenerateDisplayToken(displayID uint, orgID uint) (string, error) {
	claims := &JwtCustomClaims{
		DisplayID:      displayID,
		Role:           "display",
		OrganizationID: orgID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * 24 * 30)), // 30 day token for displays
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func JWTMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing authorization header"})
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.ParseWithClaims(tokenString, &JwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or expired token"})
		}

		claims, ok := token.Claims.(*JwtCustomClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
		}

		c.Set("user", claims)
		return next(c)
	}
}

func RBACMiddleware(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := c.Get("user").(*JwtCustomClaims)
			for _, role := range roles {
				if user.Role == role {
					return next(c)
				}
			}
			return c.JSON(http.StatusForbidden, map[string]string{"error": "Insufficient permissions"})
		}
	}
}

func GetUserFromContext(c echo.Context) *JwtCustomClaims {
	user, ok := c.Get("user").(*JwtCustomClaims)
	if !ok {
		return nil
	}
	return user
}
