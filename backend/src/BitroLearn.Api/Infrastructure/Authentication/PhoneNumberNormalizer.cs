using System.Text;
using System.Text.RegularExpressions;

namespace BitroLearn.Api.Infrastructure.Authentication;

public static partial class PhoneNumberNormalizer
{
    #region Public Methods
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input) || input.Length > 40) throw InvalidPhone();
        var builder = new StringBuilder(input.Length);
        foreach (var character in input.Trim())
        {
            if (character is >= '\u06f0' and <= '\u06f9') builder.Append((char)('0' + character - '\u06f0'));
            else if (character is >= '\u0660' and <= '\u0669') builder.Append((char)('0' + character - '\u0660'));
            else if (character is ' ' or '-' or '(' or ')' || char.IsWhiteSpace(character)) continue;
            else builder.Append(character);
        }
        var phone = builder.ToString();
        if (phone.StartsWith("00", StringComparison.Ordinal)) phone = "+" + phone[2..];
        else if (phone.Length == 11 && phone.StartsWith("09", StringComparison.Ordinal)) phone = "+98" + phone[1..];
        else if (phone.Length == 12 && phone.StartsWith("989", StringComparison.Ordinal)) phone = "+" + phone;
        else if (phone.Length == 10 && phone.StartsWith('9')) phone = "+98" + phone;
        if (!E164().IsMatch(phone)) throw InvalidPhone();
        if (phone.StartsWith("+98", StringComparison.Ordinal) && !IranMobile().IsMatch(phone)) throw InvalidPhone();
        return phone;
    }
    #endregion

    #region Private Methods
    private static ApiException InvalidPhone() => new(400, "شمارهٔ تلفن نامعتبر است.", "شمارهٔ موبایل را با قالب معتبر وارد کنید.");
    [GeneratedRegex(@"^\+[1-9][0-9]{7,14}$", RegexOptions.CultureInvariant)]
    private static partial Regex E164();
    [GeneratedRegex(@"^\+989[0-9]{9}$", RegexOptions.CultureInvariant)]
    private static partial Regex IranMobile();
    #endregion
}
