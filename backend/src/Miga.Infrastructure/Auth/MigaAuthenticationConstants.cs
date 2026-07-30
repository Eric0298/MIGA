using Microsoft.AspNetCore.Identity;

namespace Miga.Infrastructure.Auth;

public static class MigaAuthenticationConstants
{
    public static readonly string RegisteredScheme = IdentityConstants.ApplicationScheme;
    public const string DemoScheme = "Miga.Demo";
    public const string DynamicScheme = "Miga.Dynamic";

    public const string WorkspacePolicy = "WorkspaceAccess";
    public const string RegisteredPolicy = "RegisteredOnly";
    public const string DemoPolicy = "DemoOnly";

    public const string SessionIdClaim = "miga:sid";
    public const string ActorTypeClaim = "miga:actor";
    public const string RegisteredActor = "registered";
    public const string DemoActor = "demo";
}
