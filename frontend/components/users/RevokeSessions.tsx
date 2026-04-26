import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";

interface Props {
  sessionTokenId?: string;
  revokeType: "OneSessonOfUser" | "AllSessionsOfUser";
  userId?: string;
  buttonText: string;
}
export default function RevokeSessions({
  sessionTokenId,
  buttonText,
  revokeType,
  userId,
}: Props) {
  const [isRevoking, setIsRevoking] = useState(false);
  const router = useRouter();
  async function handleRevokeSessions() {
    if (revokeType === "OneSessonOfUser" && sessionTokenId) {
      await authClient.admin.revokeUserSession({
        sessionToken: sessionTokenId,
        fetchOptions: {
          onRequest() {
            setIsRevoking(true);
          },
          onResponse() {
            setIsRevoking(false);
          },
          onSuccess() {
            toast.success("Succesfully Revoked The Session");
            router.refresh();
          },
          onError(context) {
            toast.error(
              context.error.message ||
                "Failed to revoke the session ! please try again",
            );
          },
        },
      });
    }
  }
  return (
    <Button
      disabled={isRevoking}
      onClick={handleRevokeSessions}
      className="bg-primary w-fit cursor-pointer text-white"
    >
      {isRevoking ? "Revoking...." : buttonText}
    </Button>
  );
}
