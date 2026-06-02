"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { AlipayCircleFilled, WechatFilled } from "@ant-design/icons";
import { QRCode } from "antd";
import {
  Building2,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  ScanLine,
  UserRound,
} from "lucide-react";
import {
  createAuthQrChallenge,
  getAuthOAuthStartUrl,
  loginAuthAccount,
  loginAuthAccountWithCode,
  pollAuthQrChallenge,
  registerAuthAccount,
  requestAuthVerificationCode,
  resetAuthPassword,
  type AuthOAuthProvider,
  type AuthQrChallengeResponse,
} from "@/lib/backend-api";
import { cn } from "@/lib/insome/ui";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import { UnifiedNav } from "@/components/shared/unified-nav";
import { PageThemeMount } from "@/components/shared/page-theme-mount";

type AuthMode = "login" | "register" | "reset";
type AccountType = "personal" | "enterprise";
type LoginMethod = "password" | "code" | "qr";
type VerificationChannel = "email" | "phone";

const minPasswordLength = 8;

const oauthProviders: Array<{
  id: AuthOAuthProvider;
  label: string;
  icon: ReactNode;
  color?: string;
}> = [
  {
    id: "wechat",
    label: "微信",
    icon: <WechatFilled style={{ fontSize: 24 }} />,
    color: "#07c160",
  },
  {
    id: "douyin",
    label: "抖音",
    icon: <DouyinMark />,
  },
  {
    id: "alipay",
    label: "支付宝",
    icon: <AlipayCircleFilled style={{ fontSize: 24 }} />,
    color: "#1677ff",
  },
  {
    id: "microsoft",
    label: "微软",
    icon: <MicrosoftMark />,
  },
  {
    id: "google",
    label: "Google",
    icon: <GoogleMark />,
  },
];

function AuthPageContent() {
  const searchParams = useSearchParams();
  const initialModeParam = searchParams.get("mode");
  const initialMode: AuthMode =
    initialModeParam === "register"
      ? "register"
      : initialModeParam === "reset"
        ? "reset"
        : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [accountType, setAccountType] = useState<AccountType>(
    searchParams.get("accountType") === "enterprise"
      ? "enterprise"
      : "personal",
  );
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [qrProvider, setQrProvider] = useState<AuthOAuthProvider | null>(null);
  const [channel, setChannel] = useState<VerificationChannel>("phone");
  const [tenantName, setTenantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pending, setPending] = useState(false);
  const [qrPending, setQrPending] = useState(false);
  const [qrChallenge, setQrChallenge] =
    useState<AuthQrChallengeResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") || null,
  );
  const returnTo = useMemo(
    () => normalizeAuthReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  const destination = useMemo(
    () => (channel === "email" ? email : phone),
    [channel, email, phone],
  );
  const title =
    mode === "reset"
      ? "重置密码"
      : mode === "register"
        ? accountType === "enterprise"
          ? "创建企业账号"
          : "创建个人账号"
        : accountType === "enterprise"
          ? "企业用户登录"
          : "个人用户登录";
  const qrChallengeId = qrChallenge?.challengeId;
  const qrPollToken = qrChallenge?.pollToken;
  const qrStatus = qrChallenge?.status;
  const selectedQrProvider = useMemo(
    () => oauthProviders.find((provider) => provider.id === qrProvider) ?? null,
    [qrProvider],
  );

  const finishAuth = useCallback(() => {
    window.location.assign(returnTo);
  }, [returnTo]);

  const refreshQrChallenge = useCallback(async () => {
    setQrPending(true);
    setError(null);
    setNotice(null);
    try {
      const challenge = await createAuthQrChallenge({
        accountType,
        returnTo,
      });
      setQrChallenge(challenge);
    } catch (err) {
      setQrChallenge(null);
      setError(errorMessage(err));
    } finally {
      setQrPending(false);
    }
  }, [accountType, returnTo]);

  useEffect(() => {
    if (mode !== "login" || loginMethod !== "qr") {
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshQrChallenge();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loginMethod, mode, refreshQrChallenge]);

  useEffect(() => {
    if (
      mode !== "login" ||
      loginMethod !== "qr" ||
      !qrChallengeId ||
      !qrPollToken
    ) {
      return;
    }
    if (!qrStatus || !["pending", "scanned", "approved"].includes(qrStatus)) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await pollAuthQrChallenge(qrChallengeId, qrPollToken);
        if (cancelled) return;
        setQrChallenge((current) =>
          current?.challengeId === qrChallengeId
            ? {
                ...current,
                status: response.status,
                expiresInSeconds: response.expiresInSeconds,
              }
            : current,
        );
        if (response.auth) {
          finishAuth();
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      }
    };
    const timer = window.setInterval(poll, 1800);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [finishAuth, loginMethod, mode, qrChallengeId, qrPollToken, qrStatus]);

  const requestCode = async () => {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await requestAuthVerificationCode({
        channel,
        destination,
        purpose:
          mode === "register"
            ? "register"
            : mode === "reset"
              ? "reset_password"
              : "login",
      });
      if (response.debugCode) {
        setVerificationCode(response.debugCode);
        setNotice(`开发验证码 ${response.debugCode}`);
      } else {
        setNotice("验证码已发送");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (
      (mode === "register" ||
        mode === "reset" ||
        (mode === "login" && loginMethod === "password")) &&
      password.trim().length < minPasswordLength
    ) {
      setError(
        `密码至少 ${minPasswordLength} 位，建议使用字母、数字和符号组合。`,
      );
      return;
    }
    setPending(true);
    try {
      if (mode === "login" && loginMethod === "password") {
        await loginAuthAccount({ identifier, password });
        finishAuth();
        return;
      }
      if (mode === "login") {
        await loginAuthAccountWithCode({
          channel,
          destination,
          verificationCode,
        });
        finishAuth();
        return;
      }
      if (mode === "reset") {
        await resetAuthPassword({
          channel,
          destination,
          verificationCode,
          password,
        });
        setMode("login");
        setLoginMethod("password");
        setIdentifier(destination);
        setPassword("");
        setVerificationCode("");
        setNotice("密码已重置，请使用新密码登录。");
        return;
      }

      const body: Parameters<typeof registerAuthAccount>[0] = {
        tenantName:
          accountType === "enterprise"
            ? tenantName
            : tenantName || `${fullName || "个人"}的工作区`,
        fullName,
        password,
        verificationChannel: channel,
        verificationCode,
      };
      if (email.trim()) body.email = email.trim();
      if (phone.trim()) body.phone = phone.trim();
      await registerAuthAccount(body);
      finishAuth();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const selectLoginMethod = (nextMethod: Exclude<LoginMethod, "qr">) => {
    setLoginMethod(nextMethod);
    setQrProvider(null);
    setQrChallenge(null);
    setError(null);
  };

  const startProviderQrLogin = (provider: AuthOAuthProvider) => {
    if (provider === "wechat") {
      window.location.assign(getAuthOAuthStartUrl(provider, accountType, returnTo));
      return;
    }

    setMode("login");
    setLoginMethod("qr");
    setQrProvider(provider);
    setQrChallenge(null);
    setError(null);
    setNotice(null);
  };

  const startPasswordReset = () => {
    setMode("reset");
    setLoginMethod("password");
    setQrProvider(null);
    setQrChallenge(null);
    setError(null);
    setNotice(null);
    setVerificationCode("");
    setPassword("");
  };

  return (
    <>
      <PageThemeMount theme="light" />
      <UnifiedNav variant="home" showLanguageSwitch={false} />
      <main className="min-h-[calc(100vh-4rem)] bg-[#f5f6f8] px-5 py-12 text-[#101820]">
        <div className="mx-auto flex w-full max-w-[440px] flex-col items-center">
          <h1 className="text-center text-3xl font-semibold tracking-normal">
            {title}
          </h1>

          {mode !== "reset" ? (
            <div className="mt-7 grid w-full grid-cols-2 text-center text-lg font-medium">
              <SwitchButton
                active={accountType === "personal"}
                onClick={() => setAccountType("personal")}
              >
                个人用户
              </SwitchButton>
              <SwitchButton
                active={accountType === "enterprise"}
                onClick={() => setAccountType("enterprise")}
              >
                企业用户
              </SwitchButton>
            </div>
          ) : null}

          <section className="mt-10 w-full rounded-lg bg-white px-8 py-9 shadow-[0_18px_50px_rgba(28,39,49,0.08)]">
            <div className="grid grid-cols-2 text-center text-base font-semibold">
              <SwitchButton
                active={mode === "login" || mode === "reset"}
                onClick={() => setMode("login")}
              >
                登录
              </SwitchButton>
              <SwitchButton
                active={mode === "register"}
                onClick={() => setMode("register")}
              >
                注册
              </SwitchButton>
            </div>

            {mode === "login" ? (
              <div className="mt-8 grid grid-cols-2 text-center text-sm font-semibold">
                <SwitchButton
                  active={loginMethod === "password"}
                  onClick={() => selectLoginMethod("password")}
                >
                  密码登录
                </SwitchButton>
                <SwitchButton
                  active={loginMethod === "code"}
                  onClick={() => selectLoginMethod("code")}
                >
                  验证码登录
                </SwitchButton>
              </div>
            ) : null}

            {mode === "login" && loginMethod === "qr" ? (
              <QrLoginPanel
                challenge={qrChallenge}
                pending={qrPending}
                error={error}
                providerLabel={selectedQrProvider?.label}
                onRefresh={refreshQrChallenge}
              />
            ) : (
              <form className="mt-7 grid gap-4" onSubmit={submit}>
                {mode === "register" ? (
                  <>
                    {accountType === "enterprise" ? (
                      <IconField
                        icon={<Building2 className="h-4 w-4" />}
                        placeholder="企业名称"
                        value={tenantName}
                        onChange={setTenantName}
                        autoComplete="organization"
                      />
                    ) : null}
                    <IconField
                      icon={<UserRound className="h-4 w-4" />}
                      placeholder="姓名"
                      value={fullName}
                      onChange={setFullName}
                      autoComplete="name"
                    />
                    <ChannelSwitch channel={channel} setChannel={setChannel} />
                    <DestinationField
                      channel={channel}
                      email={email}
                      phone={phone}
                      setEmail={setEmail}
                      setPhone={setPhone}
                    />
                    <CodeField
                      value={verificationCode}
                      onChange={setVerificationCode}
                      onRequest={requestCode}
                      disabled={pending || !destination.trim()}
                    />
                  </>
                ) : mode === "reset" ? (
                  <>
                    <ChannelSwitch channel={channel} setChannel={setChannel} />
                    <DestinationField
                      channel={channel}
                      email={email}
                      phone={phone}
                      setEmail={setEmail}
                      setPhone={setPhone}
                    />
                    <CodeField
                      value={verificationCode}
                      onChange={setVerificationCode}
                      onRequest={requestCode}
                      disabled={pending || !destination.trim()}
                    />
                  </>
                ) : loginMethod === "password" ? (
                  <>
                    <IconField
                      icon={<UserRound className="h-4 w-4" />}
                      placeholder="手机号 / 邮箱"
                      value={identifier}
                      onChange={setIdentifier}
                      autoComplete="username"
                    />
                    <IconField
                      icon={<LockKeyhole className="h-4 w-4" />}
                      placeholder="密码"
                      type="password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                    />
                  </>
                ) : (
                  <>
                    <ChannelSwitch channel={channel} setChannel={setChannel} />
                    <DestinationField
                      channel={channel}
                      email={email}
                      phone={phone}
                      setEmail={setEmail}
                      setPhone={setPhone}
                    />
                    <CodeField
                      value={verificationCode}
                      onChange={setVerificationCode}
                      onRequest={requestCode}
                      disabled={pending || !destination.trim()}
                    />
                  </>
                )}

                {mode === "register" || mode === "reset" ? (
                  <IconField
                    icon={<LockKeyhole className="h-4 w-4" />}
                    placeholder={
                      mode === "reset"
                        ? `新密码（至少 ${minPasswordLength} 位）`
                        : `密码（至少 ${minPasswordLength} 位）`
                    }
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                  />
                ) : null}

                {error ? (
                  <div
                    role="alert"
                    className="rounded-md border border-[#ffd0ca] bg-[#fff7f5] px-3 py-2 text-sm text-[#a33120]"
                  >
                    {error}
                  </div>
                ) : null}
                {notice ? (
                  <div className="rounded-md border border-[#bee8d2] bg-[#f3fbf6] px-3 py-2 text-sm text-[#147947]">
                    {notice}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-1 h-12 rounded-md bg-[#13965d] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0f834f] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {pending
                    ? "处理中"
                    : mode === "reset"
                      ? "重置密码"
                      : mode === "login"
                        ? "登录"
                        : "注册并进入"}
                </button>
              </form>
            )}

            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-[#7a8790]">
              {mode === "login" ? (
                <>
                  <button
                    type="button"
                    onClick={startPasswordReset}
                    className="transition-colors hover:text-[#13965d]"
                  >
                    忘记密码
                  </button>
                  <span className="h-3 w-px bg-[#d8dee5]" />
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="transition-colors hover:text-[#13965d]"
                  >
                    立即注册
                  </button>
                </>
              ) : mode === "reset" ? (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="transition-colors hover:text-[#13965d]"
                >
                  已有账号，去登录
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="transition-colors hover:text-[#13965d]"
                >
                  已有账号，去登录
                </button>
              )}
            </div>

            {mode !== "reset" ? (
              <div className="mt-7 flex items-center justify-center gap-4">
                {oauthProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    title={provider.label}
                    aria-label={`${provider.label}扫码打开确认页`}
                    onClick={() => startProviderQrLogin(provider.id)}
                    style={
                      provider.color ? { color: provider.color } : undefined
                    }
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-[24px] transition-transform hover:-translate-y-0.5 hover:bg-[#f2f5f4] focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-[#13965d] focus-visible:ring-offset-2",
                      qrProvider === provider.id && loginMethod === "qr"
                        ? "ring-2 ring-[#13965d] ring-offset-2"
                        : "",
                    )}
                  >
                    {provider.icon}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center">
          <ArchLoadingFlow label="正在加载" size="hero" showLabel />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}

function QrLoginPanel({
  challenge,
  pending,
  error,
  providerLabel,
  onRefresh,
}: {
  readonly challenge: AuthQrChallengeResponse | null;
  readonly pending: boolean;
  readonly error: string | null;
  readonly providerLabel?: string | undefined;
  readonly onRefresh: () => void;
}) {
  const statusText = pending
    ? "正在生成二维码"
    : challenge?.status === "scanned"
      ? "已扫码，等待确认"
      : challenge?.status === "approved"
        ? "正在登录"
        : challenge?.status === "expired"
          ? "二维码已过期"
          : challenge?.status === "consumed"
            ? "登录已完成"
            : providerLabel
              ? `使用${providerLabel}扫码打开确认页`
              : "使用已登录设备扫码";

  return (
    <div className="mt-7 flex flex-col items-center">
      <div className="flex h-48 w-48 items-center justify-center rounded-md border border-[#e2e8e5] bg-white">
        {challenge && !pending ? (
          <QRCode
            value={challenge.qrPayload}
            size={168}
            bordered={false}
            color="#101820"
          />
        ) : (
          <ScanLine className="h-12 w-12 text-[#13965d]" aria-hidden />
        )}
      </div>
      <div className="mt-4 text-sm font-medium text-[#3f4d48]">
        {statusText}
      </div>
      {challenge?.expiresInSeconds ? (
        <div className="mt-1 text-xs text-[#8a96a0]">
          {challenge.expiresInSeconds} 秒后失效
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-4 w-full rounded-md border border-[#ffd0ca] bg-[#fff7f5] px-3 py-2 text-sm text-[#a33120]"
        >
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onRefresh}
        disabled={pending}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md border border-[#dce3e0] px-4 text-sm font-medium text-[#13965d] transition-colors hover:border-[#13965d] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? (
          <ArchLoadingFlow label="刷新中" size="inline" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        刷新二维码
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[22px] w-[22px]">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.9 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.9 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9L6.2 33.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 23 23" aria-hidden="true" className="h-[21px] w-[21px]">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function DouyinMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[22px] w-[22px]">
      <path
        fill="#25F4EE"
        d="M28.8 6h5.1c.4 3.1 2.2 5.9 4.9 7.7 1.4.9 3 1.5 4.7 1.7v5.6c-3.2-.1-6.1-1.1-8.6-2.8v13.3c0 6.5-5.3 11.8-11.8 11.8S11.3 38 11.3 31.5s5.3-11.8 11.8-11.8c.9 0 1.8.1 2.6.3v6c-.8-.3-1.6-.5-2.6-.5-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V6z"
      />
      <path
        fill="#FE2C55"
        d="M31.4 6h4.1c.4 2.7 2 5.1 4.4 6.6 1.2.8 2.6 1.3 4.1 1.4v5.2c-3-.2-5.8-1.2-8.1-2.9v13.9c0 6.3-5.1 11.4-11.4 11.4-3.9 0-7.4-2-9.4-5 2.1 1.6 4.7 2.5 7.5 2.5 6.3 0 11.4-5.1 11.4-11.4V14c-1.6-1.2-2.5-2.8-2.6-5V6z"
      />
      <path
        fill="#111827"
        d="M30.2 8.4h4.2c.8 4.5 4.4 8.1 9 8.8v4.7c-3.4-.1-6.6-1.2-9.2-3.2v12.6c0 6.1-5 11.1-11.1 11.1S12 37.4 12 31.3s5-11.1 11.1-11.1c.8 0 1.5.1 2.2.2v4.9c-.7-.3-1.4-.4-2.2-.4-3.6 0-6.4 2.9-6.4 6.4s2.9 6.4 6.4 6.4 6.4-2.9 6.4-6.4V8.4z"
      />
    </svg>
  );
}

function SwitchButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-2 pb-3 transition-colors",
        active
          ? "border-[#13965d] text-[#101820]"
          : "border-transparent text-[#8a96a0] hover:text-[#3d4a52]",
      )}
    >
      {children}
    </button>
  );
}

function ChannelSwitch({
  channel,
  setChannel,
}: {
  readonly channel: VerificationChannel;
  readonly setChannel: (channel: VerificationChannel) => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-md bg-[#f1f4f3] p-1 text-sm font-medium">
      <button
        type="button"
        onClick={() => setChannel("phone")}
        className={cn(
          "flex h-9 items-center justify-center gap-2 rounded-[5px] transition-colors",
          channel === "phone"
            ? "bg-white text-[#101820] shadow-sm"
            : "text-[#6f7d76] hover:text-[#101820]",
        )}
      >
        <Phone className="h-4 w-4" />
        手机
      </button>
      <button
        type="button"
        onClick={() => setChannel("email")}
        className={cn(
          "flex h-9 items-center justify-center gap-2 rounded-[5px] transition-colors",
          channel === "email"
            ? "bg-white text-[#101820] shadow-sm"
            : "text-[#6f7d76] hover:text-[#101820]",
        )}
      >
        <Mail className="h-4 w-4" />
        邮箱
      </button>
    </div>
  );
}

function DestinationField({
  channel,
  email,
  phone,
  setEmail,
  setPhone,
}: {
  readonly channel: VerificationChannel;
  readonly email: string;
  readonly phone: string;
  readonly setEmail: (value: string) => void;
  readonly setPhone: (value: string) => void;
}) {
  return channel === "phone" ? (
    <IconField
      icon={<Phone className="h-4 w-4" />}
      placeholder="手机号"
      value={phone}
      onChange={setPhone}
      autoComplete="tel"
    />
  ) : (
    <IconField
      icon={<Mail className="h-4 w-4" />}
      placeholder="邮箱"
      value={email}
      onChange={setEmail}
      autoComplete="email"
    />
  );
}

function CodeField({
  value,
  onChange,
  onRequest,
  disabled,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onRequest: () => void;
  readonly disabled: boolean;
}) {
  return (
    <div className="flex h-11 items-center rounded-md border border-[#dce3e0] bg-white focus-within:border-[#13965d]">
      <KeyRound className="ml-3 h-4 w-4 text-[#13965d]" aria-hidden />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="验证码"
        autoComplete="one-time-code"
        aria-label="验证码"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm !outline-none focus:!outline-none focus-visible:!outline-none"
      />
      <button
        type="button"
        onClick={onRequest}
        disabled={disabled}
        className="h-full min-w-[6.5rem] border-l border-[#e2e8e5] px-3 text-sm font-medium text-[#13965d] focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#13965d] disabled:cursor-not-allowed disabled:text-[#a8b4af]"
      >
        获取验证码
      </button>
    </div>
  );
}

function IconField({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  readonly icon: ReactNode;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: string;
  readonly autoComplete?: string;
}) {
  return (
    <label className="flex h-11 items-center rounded-md border border-[#dce3e0] bg-white px-3 transition-colors focus-within:border-[#13965d] focus-within:ring-1 focus-within:ring-[#13965d]">
      <span className="text-[#13965d]">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete={autoComplete}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm !outline-none focus:!outline-none focus-visible:!outline-none"
      />
    </label>
  );
}

function errorMessage(error: unknown): string {
  const translate = (message: string) => {
    if (/password length must be between \d+ and 1024/.test(message)) {
      return `密码至少 ${minPasswordLength} 位，最长 1024 位。`;
    }
    if (message.startsWith("invalid input: ")) {
      return message.replace("invalid input: ", "");
    }
    return message;
  };
  if (typeof error === "object" && error && "error" in error) {
    return translate(
      String((error as { error?: unknown }).error ?? "请求失败"),
    );
  }
  if (error instanceof Error) {
    return translate(error.message);
  }
  return "请求失败";
}

function normalizeAuthReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app/modules";
  }
  if (
    value === "/auth" ||
    value.startsWith("/auth?") ||
    value.startsWith("/auth/")
  ) {
    return "/app/modules";
  }
  return value;
}
