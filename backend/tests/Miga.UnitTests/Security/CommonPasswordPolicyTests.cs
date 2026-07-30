using Miga.Infrastructure.Auth;
using Shouldly;

namespace Miga.UnitTests.Security;

public sealed class CommonPasswordPolicyTests
{
    private readonly CommonPasswordPolicy _policy = new();

    [Theory]
    [InlineData("aaaaaaaaaaaa")]
    [InlineData("111111111111")]
    [InlineData("abcabcabcabc")]
    [InlineData("abcdefghijkl")]
    [InlineData("zyxwvutsrqpo")]
    public void Validate_ShouldRejectLowEntropyPatterns(string password)
    {
        var result = _policy.Validate(password);

        result.IsValid.ShouldBeFalse();
        result.ErrorCode.ShouldBe("password_too_common");
    }

    [Theory]
    [InlineData("Nubes lentas sobre Marte 42")]
    [InlineData("fjord-maple!orbit-93")]
    public void Validate_ShouldAcceptLongDiversePassphrases(string password)
    {
        _policy.Validate(password).IsValid.ShouldBeTrue();
    }
}
