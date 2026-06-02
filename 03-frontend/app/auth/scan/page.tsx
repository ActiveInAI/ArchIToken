"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LogIn, ScanLine } from "lucide-react";
import {
  approveAuthQrChallenge,
  scanAuthQrChallenge,
  type AuthQrStatusResponse,
} from "@/lib/backend-api";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import { UnifiedNav } from "@/components/shared/unified-nav";
import { PageThemeMount } from "@/components/shared/page-theme-mount";

function AuthScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challengeId") ?? "";
  const scanToken = searchParams.get("scanToken") ?? "";
  const parameterError = !challengeId || !scanToken ? "二维码参数无效" : null;
  const [status, setStatus] = useState<AuthQrStatusResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleError = parameterError ?? error;

  const canConfirm = useMemo(
    () =>
      !parameterError &&
      !pending &&
      (status?.status === "pending" || status?.status === "scanned"),
    [parameterError, pending, status?.status],
  );

  useEffect(() => {
    if (!challengeId || !scanToken) {
      return;
    }
    let cancelled = false;
    const markScanned = async () => {
      setPending(true);
      setError(null);
      try {
        const response = await scanAuthQrChallenge(challengeId, scanToken);
        if (!cancelled) {
          setStatus(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setPending(false);
        }
      }
    };
    void markScanned();
    return () => {
      cancelled = true;
    };
  }, [challengeId, scanToken]);

  const approve = async () => {
    if (!challengeId || !scanToken) return;
    setPending(true);
    setError(null);
    try {
      const response = await approveAuthQrChallenge(challengeId, scanToken);
      setStatus(response);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageThemeMount theme="light" />
      <UnifiedNav variant="home" showLanguageSwitch={false} />
      <main className="min-h-[calc(100vh-4rem)] bg-[#f5f6f8] px-5 py-12 text-[#101820]">
        <section className="mx-auto mt-14 w-full max-w-[380px] rounded-lg bg-white px-8 py-9 text-center shadow-[0_18px_50px_rgba(28,39,49,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef8f3] text-[#13965d]">
            {status?.status === "approved" ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            ) : (
              <ScanLine className="h-7 w-7" aria-hidden />
            )}
          </div>
          <h1 className="mt-5 text-2xl font-semibold">确认登录</h1>
          <p className="mt-3 text-sm text-[#6f7d76]">
            {statusText(status?.status, pending)}
          </p>
          {visibleError ? (
            <div
              role="alert"
              className="mt-5 rounded-md border border-[#ffd0ca] bg-[#fff7f5] px-3 py-2 text-sm text-[#a33120]"
            >
              {visibleError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={approve}
            disabled={!canConfirm}
            className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#13965d] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0f834f] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <CheckCircle2 className="h-4 w-4" />
            确认登录
          </button>
          {visibleError ? (
            <button
              type="button"
              onClick={() => router.push("/auth?mode=login")}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#13965d]"
            >
              <LogIn className="h-4 w-4" />
              先登录当前设备
            </button>
          ) : null}
        </section>
      </main>
    </>
  );
}

export default function AuthScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center">
          <ArchLoadingFlow label="正在加载" size="hero" showLabel />
        </div>
      }
    >
      <AuthScanPageContent />
    </Suspense>
  );
}

function statusText(status: string | undefined, pending: boolean): string {
  if (pending) return "正在处理";
  switch (status) {
    case "scanned":
      return "电脑端已收到扫码，请确认登录";
    case "approved":
      return "已确认，电脑端正在进入";
    case "expired":
      return "二维码已过期，请在电脑端刷新";
    case "consumed":
      return "本次登录已完成";
    default:
      return "请确认是否登录电脑端";
  }
}

function errorMessage(error: unknown): string {
  const translate = (message: string) => {
    if (message.includes("scan approval requires signed-in device")) {
      return "当前手机还没有登录，请先登录当前设备后再确认。";
    }
    if (message.includes("invalid QR login challenge")) {
      return "二维码无效或已过期，请在电脑端刷新二维码。";
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
