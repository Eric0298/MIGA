namespace Miga.Api.Security;

public static class ApiSecurityConstants
{
    public const int SensitiveRequestBodyLimit = 16 * 1024;

    public const string FrontendCorsPolicy = "MigaFrontend";

    public const string GlobalRatePolicy = "global";
    public const string LoginRatePolicy = "auth-login";
    public const string RegistrationRatePolicy = "auth-register";
    public const string DemoCreationRatePolicy = "auth-demo";
    public const string RecoveryRatePolicy = "auth-recovery";
    public const string PasswordMutationRatePolicy = "auth-password";
    public const string SnapshotWriteRatePolicy = "snapshot-write";
    public const string YouTubeMetadataRatePolicy = "youtube-metadata";
    public const string AccountExportRatePolicy = "account-export";
}
