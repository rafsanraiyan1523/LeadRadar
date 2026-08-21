import { Suspense } from "react";
import { FindClient } from "./find-client";

export default function FindPage() {
  return (
    <Suspense>
      <FindClient />
    </Suspense>
  );
}
