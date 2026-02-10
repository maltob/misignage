package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/ice"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
	"golang.org/x/crypto/bcrypt"
)

func GetOrgSettings(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	var org models.Organization
	if err := db.DB.First(&org, user.OrganizationID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Organization not found"})
	}

	// Mask ICE config before returning to UI
	if org.IceProvider == "cloudflare" && org.IceConfig != "" {
		decrypted, _ := util.Decrypt(org.IceConfig)
		var config ice.CloudflareConfig
		json.Unmarshal([]byte(decrypted), &config)
		config.KeyToken = util.MaskCredential(config.KeyToken)
		maskedJSON, _ := json.Marshal(config)
		org.IceConfig = string(maskedJSON)
	}

	return c.JSON(http.StatusOK, org)
}

func UpdateOrgSettings(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	if user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	var org models.Organization
	if err := db.DB.First(&org, user.OrganizationID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Organization not found"})
	}

	name := c.FormValue("name")
	if name != "" {
		org.Name = name
	}

	enableOCR := c.FormValue("enable_ocr")
	if enableOCR != "" {
		shouldEnable := enableOCR == "true"
		if shouldEnable {
			if _, err := exec.LookPath("tesseract"); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tesseract OCR not found on server. Please install it to enable this feature."})
			}
		}

		oldEnableOCR := org.EnableOCR
		org.EnableOCR = shouldEnable

		// If OCR was just enabled, queue unprocessed slides
		if shouldEnable && !oldEnableOCR {
			var slides []models.Slide
			db.DB.Where("organization_id = ? AND (type = 'image' OR type = 'video') AND ocr_content = ''", org.ID).Find(&slides)
			for _, s := range slides {
				QueueProcessingTask(s.ID)
			}
		}
	}

	interval := c.FormValue("screenshot_interval")
	if interval != "" {
		val, _ := strconv.Atoi(interval)
		org.ScreenshotInterval = val
	}

	allowOIDC := c.FormValue("allow_oidc_auto_provision")
	if allowOIDC != "" {
		org.AllowOIDCAutoProvision = allowOIDC == "true"
	}

	oidcDomain := c.FormValue("oidc_domain")
	if oidcDomain != "" {
		org.OIDCDomain = oidcDomain
	}

	retentionPolicy := c.FormValue("retention_policy")
	if retentionPolicy != "" {
		org.RetentionPolicy = retentionPolicy
	}

	iceProvider := c.FormValue("ice_provider")
	if iceProvider != "" {
		org.IceProvider = iceProvider
	}

	iceConfigRaw := c.FormValue("ice_config")
	if iceConfigRaw != "" {
		// If it's masked (contains ....), don't update the secret part
		if iceProvider == "cloudflare" {
			var newConfig ice.CloudflareConfig
			json.Unmarshal([]byte(iceConfigRaw), &newConfig)

			if strings.Contains(newConfig.KeyToken, "....") {
				// Get existing config to preserve token
				oldDecrypted, _ := util.Decrypt(org.IceConfig)
				var oldConfig ice.CloudflareConfig
				json.Unmarshal([]byte(oldDecrypted), &oldConfig)
				newConfig.KeyToken = oldConfig.KeyToken
			}

			newConfigJSON, _ := json.Marshal(newConfig)
			encrypted, _ := util.Encrypt(string(newConfigJSON))
			org.IceConfig = encrypted
		} else {
			org.IceConfig = ""
		}
	}

	db.DB.Save(&org)
	util.LogAudit(c, "UPDATE", "ORGANIZATION", org.ID, fmt.Sprintf("Updated organization settings: %s", org.Name))
	return c.JSON(http.StatusOK, org)
}

func UpdateProfile(c echo.Context) error {
	claims := c.Get("user").(*auth.JwtCustomClaims)
	var user models.User
	if err := db.DB.First(&user, claims.UserID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	email := c.FormValue("email")
	if email != "" {
		user.Email = email
	}

	password := c.FormValue("password")
	if password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user.PasswordHash = string(hash)
	}

	if err := db.DB.Save(&user).Error; err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to update profile (email might be taken)"})
	}

	util.LogAudit(c, "UPDATE", "USER", user.ID, fmt.Sprintf("Updated profile: %s", user.Email))

	return c.JSON(http.StatusOK, user)
}
