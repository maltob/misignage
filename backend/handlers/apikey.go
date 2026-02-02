package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
)

// GenerateAPIKey creates a new secure random key string
func generateKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func CreateAPIKey(c echo.Context) error {
	userClaims := c.Get("user").(*auth.JwtCustomClaims)
	name := c.FormValue("name")

	rawKey, err := generateKey()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to generate key"})
	}

	hashedKey, _ := auth.HashPassword(rawKey)

	apiKey := models.APIKey{
		Name:           name,
		Key:            hashedKey,
		Prefix:         rawKey[:8],
		OrganizationID: userClaims.OrganizationID,
		UserID:         userClaims.UserID,
	}

	if err := db.DB.Create(&apiKey).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to save key"})
	}

	util.LogAudit(c, "CREATE", "API_KEY", apiKey.ID, fmt.Sprintf("Generated API Key: %s (Prefix: %s)", apiKey.Name, apiKey.Prefix))

	// We ONLY return the raw key once upon creation
	return c.JSON(http.StatusCreated, echo.Map{
		"id":      apiKey.ID,
		"name":    apiKey.Name,
		"key":     rawKey,
		"prefix":  apiKey.Prefix,
		"expires": apiKey.ExpiresAt,
	})
}

func GetAPIKeys(c echo.Context) error {
	userClaims := c.Get("user").(*auth.JwtCustomClaims)
	var keys []models.APIKey
	db.DB.Where("organization_id = ?", userClaims.OrganizationID).Find(&keys)
	return c.JSON(http.StatusOK, keys)
}

func DeleteAPIKey(c echo.Context) error {
	userClaims := c.Get("user").(*auth.JwtCustomClaims)
	id := c.Param("id")

	if err := db.DB.Where("id = ? AND organization_id = ?", id, userClaims.OrganizationID).Delete(&models.APIKey{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to delete key"})
	}

	util.LogAudit(c, "DELETE", "API_KEY", 0, fmt.Sprintf("Revoked API Key ID: %s", id))

	return c.NoContent(http.StatusNoContent)
}

// APIKeyMiddleware validates X-API-KEY header
func APIKeyMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		key := c.Request().Header.Get("X-API-KEY")
		if key == "" {
			key = c.Request().Header.Get("X-API_KEY") // Support both common formats
		}

		if key == "" {
			return next(c)
		}

		if len(key) < 8 {
			return c.JSON(http.StatusUnauthorized, echo.Map{"error": "Invalid API Key format"})
		}

		prefix := key[:8]
		var apiKey models.APIKey
		if err := db.DB.Where("prefix = ?", prefix).First(&apiKey).Error; err != nil {
			return c.JSON(http.StatusUnauthorized, echo.Map{"error": "Invalid API Key"})
		}

		if !auth.CheckPasswordHash(key, apiKey.Key) {
			return c.JSON(http.StatusUnauthorized, echo.Map{"error": "Invalid API Key"})
		}

		// Look up the creator user for permissions
		var user models.User
		if err := db.DB.Preload("Groups").Where("id = ? AND organization_id = ?", apiKey.UserID, apiKey.OrganizationID).First(&user).Error; err != nil {
			return c.JSON(http.StatusUnauthorized, echo.Map{"error": "API Key creator no longer exists or belongs to another organization"})
		}

		var groupIDs []uint
		for _, g := range user.Groups {
			groupIDs = append(groupIDs, g.ID)
		}

		// Set the user context to the creator's identity
		c.Set("user", &auth.JwtCustomClaims{
			UserID:         user.ID,
			Email:          user.Email,
			Role:           user.Role, // Inherit role (admin, manager, viewer)
			OrganizationID: user.OrganizationID,
			GroupIDs:       groupIDs, // Inherit group access
		})

		// Update LastUsedAt
		now := time.Now()
		db.DB.Model(&apiKey).Update("last_used_at", &now)

		return next(c)
	}
}
