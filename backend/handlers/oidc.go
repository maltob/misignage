package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/google"
	"github.com/markbates/goth/providers/microsoftonline"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
)

func InitOIDC() {
	if os.Getenv("SESSION_SECRET") == "" {
		os.Setenv("SESSION_SECRET", "default_session_secret_change_me")
	}

	goth.UseProviders(
		google.New(os.Getenv("GOOGLE_KEY"), os.Getenv("GOOGLE_SECRET"), os.Getenv("BASE_URL")+"/auth/google/callback"),
		microsoftonline.New(os.Getenv("MS_KEY"), os.Getenv("MS_SECRET"), os.Getenv("BASE_URL")+"/auth/microsoftonline/callback"),
	)
}

func BeginAuth(c echo.Context) error {
	provider := c.Param("provider")
	r := c.Request()
	q := r.URL.Query()
	q.Add("provider", provider)
	r.URL.RawQuery = q.Encode()

	gothic.BeginAuthHandler(c.Response(), r)
	return nil
}

func CompleteAuth(c echo.Context) error {
	provider := c.Param("provider")
	r := c.Request()
	q := r.URL.Query()
	q.Add("provider", provider)
	r.URL.RawQuery = q.Encode()

	gothUser, err := gothic.CompleteUserAuth(c.Response(), r)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Find or create user
	var user models.User
	err = db.DB.Where("email = ?", gothUser.Email).First(&user).Error
	if err != nil {
		// New user from OIDC - Check if we can auto-provision
		parts := strings.Split(gothUser.Email, "@")
		if len(parts) < 2 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid email address from OIDC"})
		}
		domain := parts[1]

		var org models.Organization
		err = db.DB.Where("allow_oidc_auto_provision = ? AND oidc_domain = ?", true, domain).First(&org).Error
		if err != nil {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "This organization requires an administrator to invite you before you can sign in with OIDC."})
		}

		// Auto-provision user
		user = models.User{
			Email:          gothUser.Email,
			Role:           "viewer", // Default role
			OrganizationID: org.ID,
		}
		if err := db.DB.Create(&user).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to auto-provision user"})
		}
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.OrganizationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	// Redirect back to frontend with token
	redirectURL := fmt.Sprintf("%s/login?token=%s", os.Getenv("FRONTEND_URL"), token)
	return c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}
