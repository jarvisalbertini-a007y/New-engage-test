import { storage } from "../storage";
import { 
  type WhiteLabel, 
  type InsertWhiteLabel, 
  type EnterpriseSecurity, 
  type InsertEnterpriseSecurity,
  type AuditLog,
  type InsertAuditLog,
  type AccessControl,
  type InsertAccessControl 
} from "@shared/schema";
import * as crypto from "crypto";

export class EnterpriseManager {
  private encryptionAlgorithm = 'aes-256-cbc';
  
  /**
   * Configure white-label settings for an organization
   */
  async configureWhiteLabel(config: InsertWhiteLabel): Promise<WhiteLabel> {
    try {
      // Check if white-label already exists
      const existing = await storage.getWhiteLabel(config.organizationId);
      if (existing) {
        // Update existing white-label
        const updated = await storage.updateWhiteLabel(config.organizationId, config);
        if (!updated) throw new Error("Failed to update white-label configuration");
        
        // Log audit event
        await this.logAuditEvent({
          userId: null,
          organizationId: config.organizationId,
          action: "update",
          resource: "white_label",
          resourceId: existing.id,
          metadata: { brandName: config.brandName },
        });
        
        return updated;
      }
      
      // Create new white-label
      const whiteLabel = await storage.createWhiteLabel(config);
      
      // Log audit event
      await this.logAuditEvent({
        userId: null,
        organizationId: config.organizationId,
        action: "create",
        resource: "white_label",
        resourceId: whiteLabel.id,
        metadata: { brandName: config.brandName },
      });
      
      return whiteLabel;
    } catch (error) {
      console.error("Error configuring white-label:", error);
      throw error;
    }
  }
  
  /**
   * Apply security settings for an organization
   */
  async applySecuritySettings(settings: InsertEnterpriseSecurity): Promise<EnterpriseSecurity> {
    try {
      // Validate security settings
      this.validateSecuritySettings(settings);
      
      // Encrypt sensitive configuration if present
      if (settings.ssoConfig) {
        settings.ssoConfig = this.encryptData(JSON.stringify(settings.ssoConfig));
      }
      
      // Check if security settings already exist
      const existing = await storage.getEnterpriseSecurity(settings.organizationId);
      if (existing) {
        // Update existing security settings
        const updated = await storage.updateEnterpriseSecurity(settings.organizationId, settings);
        if (!updated) throw new Error("Failed to update security settings");
        
        // Log audit event
        await this.logAuditEvent({
          userId: null,
          organizationId: settings.organizationId,
          action: "update",
          resource: "security_settings",
          resourceId: existing.id,
          metadata: { 
            ssoEnabled: settings.ssoEnabled,
            mfaRequired: settings.mfaRequired,
            complianceMode: settings.complianceMode 
          },
          severity: "warning",
        });
        
        return updated;
      }
      
      // Create new security settings
      const security = await storage.createEnterpriseSecurity(settings);
      
      // Log audit event
      await this.logAuditEvent({
        userId: null,
        organizationId: settings.organizationId,
        action: "create",
        resource: "security_settings",
        resourceId: security.id,
        metadata: { 
          ssoEnabled: settings.ssoEnabled,
          mfaRequired: settings.mfaRequired 
        },
        severity: "info",
      });
      
      return security;
    } catch (error) {
      console.error("Error applying security settings:", error);
      throw error;
    }
  }
  
  /**
   * Log an audit event
   */
  async logAuditEvent(event: InsertAuditLog): Promise<AuditLog> {
    try {
      // Add timestamp and default values
      const auditLog = await storage.createAuditLog({
        ...event,
        severity: event.severity || "info",
        outcome: event.outcome || "success",
      });
      
      // Check retention policy and clean old logs if needed
      if (event.organizationId) {
        const security = await storage.getEnterpriseSecurity(event.organizationId);
        if (security?.auditLogRetention) {
          await storage.deleteOldAuditLogs(security.auditLogRetention);
        }
      }
      
      return auditLog;
    } catch (error) {
      console.error("Error logging audit event:", error);
      // Don't throw error for audit logging failures
      return {} as AuditLog;
    }
  }
  
  /**
   * Enforce permissions for a user action
   */
  async enforcePermissions(
    organizationId: string, 
    userId: string, 
    action: string, 
    resource: string
  ): Promise<boolean> {
    try {
      // Get user's access controls
      const userRoles = await storage.getUserAccessControls(organizationId, userId);
      
      if (!userRoles || userRoles.length === 0) {
        // Log unauthorized access attempt
        await this.logAuditEvent({
          userId,
          organizationId,
          action: "access_denied",
          resource,
          metadata: { reason: "no_roles_assigned" },
          severity: "warning",
          outcome: "failure",
        });
        return false;
      }
      
      // Check if any role has the required permission
      const permission = `${resource}:${action}`;
      const hasPermission = userRoles.some(role => {
        const permissions = role.permissions as string[];
        return permissions && (
          permissions.includes(permission) ||
          permissions.includes(`${resource}:*`) ||
          permissions.includes("*:*")
        );
      });
      
      if (!hasPermission) {
        // Log unauthorized access attempt
        await this.logAuditEvent({
          userId,
          organizationId,
          action: "access_denied",
          resource,
          metadata: { 
            reason: "insufficient_permissions",
            required: permission 
          },
          severity: "warning",
          outcome: "failure",
        });
      }
      
      return hasPermission;
    } catch (error) {
      console.error("Error enforcing permissions:", error);
      return false;
    }
  }
  
  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    organizationId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<any> {
    try {
      // Get audit logs for the period
      const auditLogs = await storage.getAuditLogs({
        organizationId,
        startDate,
        endDate,
      });
      
      // Get security settings
      const security = await storage.getEnterpriseSecurity(organizationId);
      
      // Get access controls
      const accessControls = await storage.getAccessControls(organizationId);
      
      // Generate report based on compliance mode
      const report = {
        organizationId,
        reportPeriod: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        complianceMode: security?.complianceMode || "none",
        summary: {
          totalEvents: auditLogs.length,
          uniqueUsers: new Set(auditLogs.map(log => log.userId)).size,
          criticalEvents: auditLogs.filter(log => log.severity === "critical").length,
          failedActions: auditLogs.filter(log => log.outcome === "failure").length,
        },
        securitySettings: {
          ssoEnabled: security?.ssoEnabled || false,
          mfaRequired: security?.mfaRequired || false,
          dataResidency: security?.dataResidency || "us",
          ipWhitelist: security?.ipWhitelist?.length || 0,
        },
        accessControl: {
          totalRoles: accessControls.length,
          systemRoles: accessControls.filter(ac => ac.isSystemRole).length,
          customRoles: accessControls.filter(ac => !ac.isSystemRole).length,
        },
        eventsByResource: this.groupEventsByResource(auditLogs),
        eventsByUser: this.groupEventsByUser(auditLogs),
        eventsBySeverity: this.groupEventsBySeverity(auditLogs),
        complianceChecks: this.performComplianceChecks(security, auditLogs, accessControls),
      };
      
      // Log report generation
      await this.logAuditEvent({
        userId: null,
        organizationId,
        action: "generate_report",
        resource: "compliance",
        metadata: { 
          reportType: "compliance",
          period: `${startDate.toISOString()} to ${endDate.toISOString()}`
        },
      });
      
      return report;
    } catch (error) {
      console.error("Error generating compliance report:", error);
      throw error;
    }
  }
  
  /**
   * Manage SSO integration
   */
  async manageSSOIntegration(
    organizationId: string, 
    provider: string, 
    config: any
  ): Promise<EnterpriseSecurity> {
    try {
      // Validate SSO configuration based on provider
      this.validateSSOConfig(provider, config);
      
      // Encrypt sensitive SSO configuration
      const encryptedConfig = this.encryptData(JSON.stringify(config));
      
      // Update security settings with SSO configuration
      const security = await storage.getEnterpriseSecurity(organizationId);
      if (!security) {
        throw new Error("Security settings not found for organization");
      }
      
      const updated = await storage.updateEnterpriseSecurity(organizationId, {
        ssoEnabled: true,
        ssoProvider: provider,
        ssoConfig: encryptedConfig,
      });
      
      if (!updated) throw new Error("Failed to update SSO settings");
      
      // Log SSO configuration
      await this.logAuditEvent({
        userId: null,
        organizationId,
        action: "configure",
        resource: "sso",
        metadata: { provider },
        severity: "warning",
      });
      
      return updated;
    } catch (error) {
      console.error("Error managing SSO integration:", error);
      throw error;
    }
  }
  
  /**
   * Encrypt sensitive data
   */
  encryptSensitiveData(data: string, key?: string): string {
    return this.encryptData(data, key);
  }
  
  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData: string, key?: string): string {
    return this.decryptData(encryptedData, key);
  }
  
  // Private helper methods
  
  private validateSecuritySettings(settings: InsertEnterpriseSecurity): void {
    // Validate IP whitelist format
    if (settings.ipWhitelist && settings.ipWhitelist.length > 0) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/\d{1,2})?$/;
      for (const ip of settings.ipWhitelist) {
        if (!ipRegex.test(ip)) {
          throw new Error(`Invalid IP address format: ${ip}`);
        }
      }
    }
    
    // Validate session timeout
    if (settings.sessionTimeout && (settings.sessionTimeout < 5 || settings.sessionTimeout > 10080)) {
      throw new Error("Session timeout must be between 5 minutes and 7 days");
    }
    
    // Validate audit log retention
    if (settings.auditLogRetention && (settings.auditLogRetention < 7 || settings.auditLogRetention > 2555)) {
      throw new Error("Audit log retention must be between 7 days and 7 years");
    }
  }
  
  private validateSSOConfig(provider: string, config: any): void {
    switch (provider) {
      case "saml":
        if (!config.entityId || !config.ssoUrl || !config.certificate) {
          throw new Error("SAML configuration requires entityId, ssoUrl, and certificate");
        }
        break;
      case "oauth2":
        if (!config.clientId || !config.clientSecret || !config.authorizationUrl || !config.tokenUrl) {
          throw new Error("OAuth2 configuration requires clientId, clientSecret, authorizationUrl, and tokenUrl");
        }
        break;
      case "okta":
        if (!config.domain || !config.clientId || !config.clientSecret) {
          throw new Error("Okta configuration requires domain, clientId, and clientSecret");
        }
        break;
      case "azure-ad":
        if (!config.tenantId || !config.clientId || !config.clientSecret) {
          throw new Error("Azure AD configuration requires tenantId, clientId, and clientSecret");
        }
        break;
      default:
        throw new Error(`Unsupported SSO provider: ${provider}`);
    }
  }
  
  private encryptData(data: string, key?: string): any {
    const encryptionKey = key || process.env.ENCRYPTION_KEY || "default-encryption-key-change-in-production";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.encryptionAlgorithm, 
      Buffer.from(encryptionKey.padEnd(32).slice(0, 32)), 
      iv
    );
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted,
    };
  }
  
  private decryptData(encryptedData: any, key?: string): string {
    const encryptionKey = key || process.env.ENCRYPTION_KEY || "default-encryption-key-change-in-production";
    const decipher = crypto.createDecipheriv(
      this.encryptionAlgorithm,
      Buffer.from(encryptionKey.padEnd(32).slice(0, 32)),
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  private groupEventsByResource(logs: AuditLog[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const log of logs) {
      grouped[log.resource] = (grouped[log.resource] || 0) + 1;
    }
    return grouped;
  }
  
  private groupEventsByUser(logs: AuditLog[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const log of logs) {
      if (log.userId) {
        grouped[log.userId] = (grouped[log.userId] || 0) + 1;
      }
    }
    return grouped;
  }
  
  private groupEventsBySeverity(logs: AuditLog[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const log of logs) {
      grouped[log.severity] = (grouped[log.severity] || 0) + 1;
    }
    return grouped;
  }
  
  private performComplianceChecks(
    security: EnterpriseSecurity | undefined,
    logs: AuditLog[],
    accessControls: AccessControl[]
  ): any {
    const checks: any = {
      passed: [],
      failed: [],
      warnings: [],
    };
    
    if (!security) {
      checks.failed.push("No security settings configured");
      return checks;
    }
    
    // Check based on compliance mode
    switch (security.complianceMode) {
      case "soc2":
        // SOC 2 compliance checks
        if (security.mfaRequired) checks.passed.push("MFA is required");
        else checks.failed.push("MFA is not required (SOC 2 requirement)");
        
        if (security.auditLogRetention >= 90) checks.passed.push("Audit log retention meets requirements");
        else checks.failed.push("Audit log retention less than 90 days");
        
        if (accessControls.length > 0) checks.passed.push("Access controls are configured");
        else checks.failed.push("No access controls configured");
        break;
        
      case "gdpr":
        // GDPR compliance checks
        if (security.dataResidency === "eu") checks.passed.push("Data residency in EU");
        else checks.warnings.push("Data not stored in EU region");
        
        if (security.encryptionKey) checks.passed.push("Data encryption configured");
        else checks.failed.push("No encryption key configured");
        break;
        
      case "ccpa":
        // CCPA compliance checks
        if (security.dataResidency === "us") checks.passed.push("Data residency in US");
        
        const deletionLogs = logs.filter(log => log.action === "delete" && log.resource === "user_data");
        if (deletionLogs.length > 0) checks.passed.push("User data deletion capabilities demonstrated");
        break;
        
      case "hipaa":
        // HIPAA compliance checks
        if (security.mfaRequired) checks.passed.push("MFA is required");
        else checks.failed.push("MFA is not required (HIPAA requirement)");
        
        if (security.encryptionKey) checks.passed.push("Data encryption configured");
        else checks.failed.push("No encryption key configured (HIPAA requirement)");
        
        if (security.auditLogRetention >= 180) checks.passed.push("Audit log retention meets HIPAA requirements");
        else checks.failed.push("Audit log retention less than 180 days (HIPAA requirement)");
        break;
    }
    
    return checks;
  }
}

// Export singleton instance
export const enterpriseManager = new EnterpriseManager();