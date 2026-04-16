import { NextResponse } from "next/server";

export const GET = (): NextResponse => {
  return NextResponse.json({ status: "ok" });
};

export const POST = (): NextResponse => {
  return NextResponse.json({ status: "ok" });
};
