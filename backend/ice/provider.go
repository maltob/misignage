package ice

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/maltob/misignage/util"
)

// IceServer represents a STUN or TURN server configuration
type IceServer struct {
	Urls       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

// Provider defines the interface for fetching ICE servers
type Provider interface {
	GetIceServers() ([]IceServer, error)
}

// DefaultProvider returns a standard list of public STUN servers
type DefaultProvider struct{}

func (p *DefaultProvider) GetIceServers() ([]IceServer, error) {
	return []IceServer{
		{Urls: []string{"stun:stun.l.google.com:19302"}},
		{Urls: []string{"stun:stun1.l.google.com:19302"}},
		{Urls: []string{"stun:stun2.l.google.com:19302"}},
		{Urls: []string{"stun:stun.services.mozilla.com"}},
	}, nil
}

// CloudflareConfig stores Cloudflare TURN API credentials
type CloudflareConfig struct {
	KeyID    string `json:"key_id"`
	KeyToken string `json:"key_token"`
}

// CloudflareProvider implements Cloudflare's dynamic TURN credential API
type CloudflareProvider struct {
	Config CloudflareConfig
}

func (p *CloudflareProvider) GetIceServers() ([]IceServer, error) {
	if p.Config.KeyID == "" || p.Config.KeyToken == "" {
		return nil, fmt.Errorf("Cloudflare config missing KeyID or KeyToken")
	}

	url := fmt.Sprintf("https://rtc.cloudflare.com/turn/keys/%s/credentials", p.Config.KeyID)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+p.Config.KeyToken)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Cloudflare API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		IceServers IceServer `json:"iceServers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Cloudflare returns a single IceServer object with multiple domains in Urls
	// We combine it with default STUN servers for better reliability
	stunServers := []IceServer{
		{Urls: []string{"stun:stun.l.google.com:19302"}},
		{Urls: []string{"stun:stun.services.mozilla.com"}},
	}

	return append(stunServers, result.IceServers), nil
}

// GetProvider returns the appropriate provider based on organization settings
func GetProvider(providerName string, encryptedConfig string) Provider {
	switch providerName {
	case "cloudflare":
		configJSON, err := util.Decrypt(encryptedConfig)
		if err != nil {
			fmt.Printf("[ICE] Failed to decrypt config for %s: %v\n", providerName, err)
			return &DefaultProvider{}
		}

		var config CloudflareConfig
		if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
			fmt.Printf("[ICE] Failed to unmarshal config for %s: %v\n", providerName, err)
			return &DefaultProvider{}
		}

		return &CloudflareProvider{Config: config}
	default:
		return &DefaultProvider{}
	}
}
