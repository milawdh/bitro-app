namespace BitroLearn.Api.Infrastructure.SMS;

public interface ISMSProvider
{
    #region Public Methods
    Task SendOTPSMS(string phoneNumber, string code);
    #endregion
}

public sealed class ConsoleSMSProvider : ISMSProvider
{
    #region Public Methods
    public Task SendOTPSMS(string phoneNumber, string code)
    {
        Console.WriteLine("[OTP SMS] Phone: {0}; Code: {1}", phoneNumber, code);
        return Task.CompletedTask;
    }
    #endregion
}
