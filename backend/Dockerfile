FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_SYSTEM_NET_HTTP_SOCKETSHTTPHANDLER_HTTP2SUPPORT=false DOTNET_SYSTEM_NET_DISABLEIPV6=1
ENV NUGET_CERT_REVOCATION_MODE=offline
COPY NuGet.Config ./
COPY src/BitroLearn.Api/BitroLearn.Api.csproj src/BitroLearn.Api/packages.lock.json ./src/BitroLearn.Api/
RUN --mount=type=cache,id=bitro-backend-nuget-v1,target=/root/.nuget/packages,sharing=locked \
    --mount=type=cache,id=bitro-backend-nuget-http-v1,target=/root/.local/share/NuGet/http-cache,sharing=locked \
    dotnet restore src/BitroLearn.Api/BitroLearn.Api.csproj --locked-mode --disable-parallel
COPY src ./src
RUN --mount=type=cache,id=bitro-backend-nuget-v1,target=/root/.nuget/packages,sharing=locked \
    dotnet publish src/BitroLearn.Api/BitroLearn.Api.csproj --no-restore -c Release -o /publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 DOTNET_CLI_TELEMETRY_OPTOUT=1
COPY --from=build --chown=app:app /publish .
USER app
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=8s --start-period=25s --retries=3 CMD ["dotnet", "BitroLearn.Api.dll", "--healthcheck"]
ENTRYPOINT ["dotnet", "BitroLearn.Api.dll"]
