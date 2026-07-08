using Miga.Application.Materials;
using Shouldly;

namespace Miga.UnitTests.Materials;

public sealed class YouTubeUrlParserTests
{
    [Theory]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("http://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "dQw4w9WgXcQ")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ?t=90", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    public void TryParseVideoId_ShouldParse_ValidUrls(string url, string expected)
    {
        var success = YouTubeUrlParser.TryParseVideoId(url, out var videoId);
        success.ShouldBeTrue();
        videoId.ShouldBe(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not a url")]
    [InlineData("ftp://youtube.com/watch?v=dQw4w9WgXcQ")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://evil.example.com/watch?v=dQw4w9WgXcQ")]
    [InlineData("https://vimeo.com/12345")]
    [InlineData("https://www.youtube.com/watch")]
    [InlineData("https://www.youtube.com/watch?v=short")]
    [InlineData("https://www.youtube.com/watch?v=too-long-video-id-123")]
    [InlineData("https://www.youtube.com/watch?v=has spaces")]
    [InlineData("https://youtu.be/")]
    public void TryParseVideoId_ShouldReject_InvalidUrls(string? url)
    {
        var success = YouTubeUrlParser.TryParseVideoId(url, out var videoId);
        success.ShouldBeFalse();
        videoId.ShouldBeNull();
    }

    [Fact]
    public void TryParseVideoId_ShouldReject_UrlsBeyondLimit()
    {
        var longQuery = new string('a', 3000);
        var url = $"https://www.youtube.com/watch?v=dQw4w9WgXcQ&x={longQuery}";
        YouTubeUrlParser.TryParseVideoId(url, out var videoId).ShouldBeFalse();
        videoId.ShouldBeNull();
    }
}
