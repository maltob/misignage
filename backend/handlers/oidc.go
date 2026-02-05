package handlers

import (
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"

	"path/filepath"

	"github.com/gorilla/sessions"
	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/google"
	"github.com/markbates/goth/providers/openidConnect"
)

func InitOIDC() {
	if os.Getenv("SESSION_SECRET") == "" {
		os.Setenv("SESSION_SECRET", "default_session")
	}

	sessionPath := filepath.Join(os.TempDir(), "misignage_sessions")
	_ = os.MkdirAll(sessionPath, 0700)
	store := sessions.NewFilesystemStore(sessionPath, []byte(os.Getenv("SESSION_SECRET")))
	store.MaxLength(math.MaxInt32)
	gothic.Store = store
	providers := []goth.Provider{
		google.New(os.Getenv("GOOGLE_KEY"), os.Getenv("GOOGLE_SECRET"), os.Getenv("BASE_URL")+"/auth/google/callback"),
	}

	discoveryURL := os.Getenv("OIDC_DISCOVERY_URL")
	if discoveryURL == "" {
		discoveryURL = "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
	}

	if oidcProvider, err := openidConnect.New(
		os.Getenv("OIDC_CLIENT_ID"),
		os.Getenv("OIDC_CLIENT_SECRET"),
		os.Getenv("BASE_URL")+"/auth/openid-connect/callback",
		discoveryURL,
		"openid", "profile", "email",
	); err == nil {
		providers = append(providers, oidcProvider)
	} else {
		fmt.Println("Failed to initialize OIDC provider:", err)
	}

	goth.UseProviders(providers...)
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
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid email address from OIDC - " + gothUser.Email})
		}
		domain := parts[1]

		var org models.Organization
		err = db.DB.Where("allow_o_id_c_auto_provision = ? AND o_id_c_domain = ?", 1, domain).First(&org).Error
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

	var groupIDs []uint
	db.DB.Model(&user).Association("Groups").Find(&user.Groups)
	for _, g := range user.Groups {
		groupIDs = append(groupIDs, g.ID)
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Role, user.OrganizationID, groupIDs)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	// Return auto-submitting form to POST token to frontend
	htmlPayload := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>Authenticating...</title>
		</head>
		<body onload="document.forms[0].submit()">
			<form method="POST" action="%s/login">
				<input type="hidden" name="token" value="%s">
			</form>
		</body>
		</html>
	`, os.Getenv("BASE_URL"), token)

	return c.HTML(http.StatusOK, htmlPayload)
}
