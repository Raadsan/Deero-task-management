import { Mail, Shield } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="flex w-full max-w-4xl flex-col gap-8 rounded-2xl bg-white p-8 shadow-2xl">
        {/* Icon and summary */}
        <div className="flex w-full flex-col items-center justify-center">
          <div className="mb-4 rounded-full bg-linear-to-r from-orange-500 to-red-500 p-4">
            <Mail className="h-14 w-14 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Verify Your Email
          </h1>
          <p className="mb-2 text-base text-gray-600">
            A verification link was sent to your email.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <Shield className="h-5 w-5 text-red-600" />
            <span className="text-sm font-semibold text-red-800">Required</span>
          </div>
        </div>
        {/* Steps and help */}
        <div className="flex w-full flex-col items-center justify-between">
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              How to verify:
            </h3>
            <ol className="mb-4 flex flex-col gap-4 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                  1
                </span>
                Open your email inbox
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                  2
                </span>
                Find the email from{" "}
                <span className="font-semibold">
                  DEERO ADVERTISEMENT AGENCY
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                  3
                </span>
                Click the <span className="font-semibold">Verify Email</span>{" "}
                button
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                  4
                </span>
                Return here to login
              </li>
            </ol>
          </div>
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="mb-1 text-xs text-gray-500">
              Didn't receive the email? Check your spam folder.
            </p>
            <p className="text-xs text-gray-500">
              Need help?{" "}
              <a
                href="#"
                className="text-orange-600 underline hover:text-orange-700"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
