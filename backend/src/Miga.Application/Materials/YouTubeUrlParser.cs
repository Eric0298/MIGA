using System.Text.RegularExpressions;

namespace Miga.Application.Materials;

/// <summary>
/// Pure parser that extracts a YouTube video id from any of the accepted URL variants.
/// Runs entirely offline — no network calls, no allocations beyond the regex/split.
/// Only http/https and whitelisted YouTube hosts are accepted.
/// </summary>
public static class YouTubeUrlParser
{
    private static readonly HashSet<string> AllowedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com"
    };

    private static readonly Regex VideoIdRegex = new(
        "^[A-Za-z0-9_-]{11}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private const int MaxUrlLength = 2048;

    public static bool TryParseVideoId(string? url, out string? videoId)
    {
        videoId = null;

        if (string.IsNullOrWhiteSpace(url))
        {
            return false;
        }

        if (url.Length > MaxUrlLength)
        {
            return false;
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            return false;
        }

        if (!AllowedHosts.Contains(uri.Host))
        {
            return false;
        }

        var candidate = ExtractCandidate(uri);
        if (candidate is null)
        {
            return false;
        }

        if (!VideoIdRegex.IsMatch(candidate))
        {
            return false;
        }

        videoId = candidate;
        return true;
    }

    private static string? ExtractCandidate(Uri uri)
    {
        // youtu.be/<id>[/...]
        if (string.Equals(uri.Host, "youtu.be", StringComparison.OrdinalIgnoreCase))
        {
            var segment = uri.AbsolutePath.Trim('/').Split('/', 2, StringSplitOptions.RemoveEmptyEntries);
            return segment.Length > 0 ? segment[0] : null;
        }

        // /embed/<id>, /shorts/<id>, /live/<id>
        var path = uri.AbsolutePath;
        var pathPrefixes = new[] { "/embed/", "/shorts/", "/live/" };
        foreach (var prefix in pathPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var remainder = path[prefix.Length..];
                var segment = remainder.Split('/', 2, StringSplitOptions.RemoveEmptyEntries);
                return segment.Length > 0 ? segment[0] : null;
            }
        }

        // /watch?v=<id>
        if (string.Equals(path, "/watch", StringComparison.OrdinalIgnoreCase))
        {
            return GetQueryValue(uri.Query, "v");
        }

        return null;
    }

    private static string? GetQueryValue(string query, string key)
    {
        if (string.IsNullOrEmpty(query))
        {
            return null;
        }

        var trimmed = query.StartsWith('?') ? query[1..] : query;
        foreach (var pair in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length != 2)
            {
                continue;
            }

            if (string.Equals(kv[0], key, StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(kv[1]);
            }
        }

        return null;
    }
}
