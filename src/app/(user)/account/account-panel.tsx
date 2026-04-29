"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  changeAccountPassword,
  generateInviteCode,
  requestAccountEmailChange,
  updateAccountProfile,
} from "@/actions/user/account";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { AccountInviteCard } from "./_components/account-invite-card";
import { AccountPasswordCard } from "./_components/account-password-card";
import { AccountProfileCard } from "./_components/account-profile-card";
import type { AccountPanelUser } from "./account-types";

interface Props {
  user: AccountPanelUser;
}

export function AccountPanel({ user }: Props) {
  const router = useRouter();
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState(user.inviteCode);
  const [inviteLoading, setInviteLoading] = useState(false);

  async function handleProfileSubmit(formData: FormData) {
    setProfileSaving(true);
    try {
      await updateAccountProfile(formData);
      toast.success("资料已更新");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "更新资料失败"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleEmailSubmit(formData: FormData) {
    setEmailSaving(true);
    try {
      await requestAccountEmailChange(formData);
      toast.success("确认邮件已发送，请查收新邮箱");
      (document.getElementById("account-email-form") as HTMLFormElement | null)?.reset();
    } catch (error) {
      toast.error(getErrorMessage(error, "发送确认邮件失败"));
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPasswordSaving(true);
    try {
      await changeAccountPassword(formData);
      toast.success("密码已更新");
      (document.getElementById("account-password-form") as HTMLFormElement | null)?.reset();
    } catch (error) {
      toast.error(getErrorMessage(error, "修改密码失败"));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleInviteCode() {
    setInviteLoading(true);
    try {
      const code = await generateInviteCode();
      setInviteCode(code);
      toast.success("邀请码已生成");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "生成邀请码失败"));
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.82fr)]">
      <div className="space-y-5">
        <AccountProfileCard
          user={user}
          isSaving={profileSaving}
          isEmailSaving={emailSaving}
          onSubmit={handleProfileSubmit}
          onEmailSubmit={handleEmailSubmit}
        />
        <AccountPasswordCard email={user.email} isSaving={passwordSaving} onSubmit={handlePasswordSubmit} />
      </div>
      <AccountInviteCard
        inviteCode={inviteCode}
        invitedUsersCount={user.invitedUsersCount}
        inviteRewardCount={user.inviteRewardCount}
        inviteRewardAmount={user.inviteRewardAmount}
        createdAt={user.createdAt}
        isLoading={inviteLoading}
        onGenerate={() => {
          void handleInviteCode();
        }}
      />
    </div>
  );
}
