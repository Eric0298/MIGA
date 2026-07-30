using Miga.Application.Common.Security;
using Shouldly;

namespace Miga.UnitTests.Security;

public sealed class LogSanitizerTests
{
    [Theory]
    [InlineData("plain text", "plain text")]
    [InlineData("carriage\rreturn", "carriage_return")]
    [InlineData("new\nline", "new_line")]
    [InlineData("crlf\r\npayload", "crlf__payload")]
    [InlineData("tab\tseparated", "tab_separated")]
    [InlineData("null\0inside", "null_inside")]
    [InlineData("bellandescape", "bell_and_escape")]
    public void Sanitize_ShouldReplaceControlCharacters(string input, string expected)
    {
        LogSanitizer.Sanitize(input).ShouldBe(expected);
    }

    [Fact]
    public void Sanitize_ShouldReturnEmpty_ForNullOrEmpty()
    {
        LogSanitizer.Sanitize(null).ShouldBe(string.Empty);
        LogSanitizer.Sanitize(string.Empty).ShouldBe(string.Empty);
    }

    [Fact]
    public void Sanitize_ShouldEnforceMaxLength()
    {
        var input = new string('a', 1000);

        var result = LogSanitizer.Sanitize(input, maxLength: 32);

        result.Length.ShouldBe(32);
        result.ShouldNotContain('\r');
        result.ShouldNotContain('\n');
    }

    [Fact]
    public void Sanitize_ShouldNeverContainLineBreaks_EvenForHostilePayload()
    {
        var payload = "attacker\r\n[FAKE] granted-admin=true\r\ntrailing";

        var result = LogSanitizer.Sanitize(payload);

        result.ShouldNotContain('\r');
        result.ShouldNotContain('\n');
        result.ShouldNotContain(payload); // literal payload must not survive
    }

    [Theory]
    [InlineData(null, "UNKNOWN")]
    [InlineData("", "UNKNOWN")]
    [InlineData("get", "GET")]
    [InlineData("POST", "POST")]
    [InlineData("Delete", "DELETE")]
    [InlineData("PROPFIND", "OTHER")]
    [InlineData("GET\r\nHost: attacker", "OTHER")]
    [InlineData("012345678901234567890", "OTHER")]
    public void SanitizeHttpMethod_ShouldReturnWhitelistedValue(string? input, string expected)
    {
        LogSanitizer.SanitizeHttpMethod(input).ShouldBe(expected);
    }

    [Fact]
    public void SanitizeHttpMethod_ShouldNeverEmitControlCharacters()
    {
        var hostile = "GET\r\n\r\nX-Injected: 1";

        var result = LogSanitizer.SanitizeHttpMethod(hostile);

        result.ShouldNotContain('\r');
        result.ShouldNotContain('\n');
    }

    [Fact]
    public void Fingerprint_ShouldReturnStableSixteenHexCharacters()
    {
        var first = LogSanitizer.Fingerprint("some-video-id");
        var second = LogSanitizer.Fingerprint("some-video-id");

        first.Length.ShouldBe(16);
        first.ShouldMatch("^[0-9A-F]{16}$");
        first.ShouldBe(second);
    }

    [Fact]
    public void Fingerprint_ShouldDifferForDifferentInputs()
    {
        LogSanitizer.Fingerprint("aaa").ShouldNotBe(LogSanitizer.Fingerprint("aab"));
    }

    [Fact]
    public void Fingerprint_ShouldReturnZeroToken_ForNullOrEmpty()
    {
        LogSanitizer.Fingerprint(null).ShouldBe("0000000000000000");
        LogSanitizer.Fingerprint(string.Empty).ShouldBe("0000000000000000");
    }

    [Fact]
    public void Fingerprint_ShouldNotContainLineBreaks_ForHostilePayload()
    {
        var payload = "video\r\n[FAKE] admin=true\r\n";

        var result = LogSanitizer.Fingerprint(payload);

        result.Length.ShouldBe(16);
        result.ShouldNotContain('\r');
        result.ShouldNotContain('\n');
    }

    [Fact]
    public void Sanitize_ShouldNotThrow_ForExtremelyLongInput()
    {
        var huge = new string('x', 10 * 1024 * 1024) + "\r\ntrailer";

        var result = LogSanitizer.Sanitize(huge, maxLength: 128);

        result.Length.ShouldBe(128);
        result.ShouldNotContain('\r');
    }
}
