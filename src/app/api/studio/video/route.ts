import { NextResponse } from "next/server";

export const POST = (): NextResponse => {
  return NextResponse.json({ status: "ok" });
};
