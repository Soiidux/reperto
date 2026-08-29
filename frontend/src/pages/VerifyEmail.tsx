import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { verifyEmail } from "@/api/auth";
import { getErrorMessage } from "@/lib/utils";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(
    token
      ? ""
      : "This verification link is missing its token. Please use the link from your email.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const response = await verifyEmail(token);
        if (!cancelled) {
          setStatus("success");
          setMessage(response?.data?.message || "Email verified successfully.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(getErrorMessage(error, "This verification link is invalid or has expired."));
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="w-[400px] sm:w-[450px] mx-auto p-4 shrink-0">
      <Card className="w-full shadow-md border border-neutral-100">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
            Verify Email
          </CardTitle>
          <CardDescription className="text-center text-neutral-500">
            {status === "loading" ? "Confirming your email address…" : message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === "loading" && <p className="text-sm text-neutral-500 text-center">Please wait.</p>}
          {status === "error" && (
            <Button asChild variant="outline" className="w-full">
              <Link to="/register">Go to register</Link>
            </Button>
          )}
          {status === "success" && (
            <Button asChild className="w-full">
              <Link to="/login">Proceed to login</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;