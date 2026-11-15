namespace BitroLearn.Api.Infrastructure.Authentication;

public sealed class ApiException(int statusCode, string title, string? detail = null) : Exception(detail ?? title)
{
    #region Properties
    public int StatusCode { get; } = statusCode;
    public string Title { get; } = title;
    public string? Detail { get; } = detail;
    #endregion
}
