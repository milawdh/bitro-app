using BitroLearn.Api.Infrastructure.Authentication;

namespace BitroLearn.Api.Tests;

public sealed class PhoneNumberTests
{
    #region Accepted phone formats

    [Theory]
    [InlineData("09123456789", "+989123456789")]
    [InlineData("۹۱۲۳۴۵۶۷۸۹", "+989123456789")]
    [InlineData("٠٩١٢٣٤٥٦٧٨٩", "+989123456789")]
    [InlineData("0098 912 345 6789", "+989123456789")]
    [InlineData("989123456789", "+989123456789")]
    [InlineData("+98 (912) 345-6789", "+989123456789")]
    [InlineData("+14155552671", "+14155552671")]
    public void Equivalent_phone_forms_resolve_to_same_account_key(string input, string expected)
    {
        Assert.Equal(expected, PhoneNumberNormalizer.Normalize(input));
    }

    #endregion

    #region Invalid phone input

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("phone")]
    [InlineData("09123")]
    [InlineData("+982112345678")]
    [InlineData("+9891234567890")]
    [InlineData("+0000000000")]
    [InlineData("+989123456789<script>")]
    public void Invalid_phone_cannot_create_an_otp_challenge(string? input)
    {
        var error = Assert.Throws<ApiException>(() => PhoneNumberNormalizer.Normalize(input));
        Assert.Equal(400, error.StatusCode);
    }

    #endregion
}
