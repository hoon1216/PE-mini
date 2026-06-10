import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "선호도 평가",
  description: "모바일 선호도 평가 참여 페이지",
};

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
