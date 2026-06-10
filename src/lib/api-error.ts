import { Prisma } from "@prisma/client";

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2022") {
      return "데이터베이스 스키마가 최신이 아닙니다. npx prisma db push 후 다시 시도해주세요.";
    }
    if (err.code === "P2002") {
      return "이미 등록된 정보와 충돌합니다.";
    }
    if (err.code === "P2021") {
      return "데이터베이스 테이블이 없습니다. npx prisma db push를 실행해주세요.";
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return "데이터베이스에 연결할 수 없습니다. DATABASE_URL과 Neon 연결을 확인해주세요.";
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "요청에 실패했습니다.";
}
