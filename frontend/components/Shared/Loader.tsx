import { Skeleton } from "../ui/skeleton";

export default function Spinner() {
  return <div className="loader mx-auto" />;
}

export function SummarySkeltonLoader() {
  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="flex h-[150px] flex-col justify-between rounded-[10px] border border-black/10 bg-white p-6 shadow-sm"
        >
          <div>
            <Skeleton className="mb-2 h-6 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex items-end justify-between">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReceivablePayableTableSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <Skeleton className="h-8 w-1/3" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>
                <Skeleton className="h-5 w-20" />
              </th>
              <th>
                <Skeleton className="h-5 w-16" />
              </th>
              <th>
                <Skeleton className="h-5 w-20" />
              </th>
              <th>
                <Skeleton className="h-5 w-20" />
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(2)].map((_, i) => (
              <tr key={i}>
                <td>
                  <Skeleton className="my-2 h-6 w-24" />
                </td>
                <td>
                  <Skeleton className="my-2 h-6 w-16" />
                </td>
                <td>
                  <Skeleton className="my-2 h-6 w-20" />
                </td>
                <td>
                  <Skeleton className="my-2 h-6 w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const barHeights = [
  "40%",
  "60%",
  "50%",
  "70%",
  "55%",
  "65%",
  "45%",
  "60%",
  "50%",
  "70%",
  "55%",
  "65%",
];

export function ChartSkeletonLoader({ bars = 12 }: { bars?: number }) {
  return (
    <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex h-64 w-full items-end gap-2">
        {[...Array(bars)].map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded bg-gray-200"
            style={{
              height: barHeights[i % barHeights.length],
              minHeight: "40px",
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-between text-xs text-gray-400">
        {[...Array(bars)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-12" />
        ))}
      </div>
    </div>
  );
}

export function GeneralTableSkeletonLoader({
  cols = 6,
  rows = 3,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-0 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {[...Array(cols)].map((_, i) => (
                <th
                  key={i}
                  className="bg-linear-to-r from-[#7b1616] to-[#e94e1b] px-4 py-3"
                >
                  <Skeleton className="h-5 w-20 bg-[#a53c3c]" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, rowIdx) => (
              <tr key={rowIdx} className="bg-gray-50">
                {[...Array(cols)].map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <Skeleton className="h-6 w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClientSourcesSkeletonLoader() {
  return (
    <div className="flex w-full flex-wrap justify-center gap-6">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="flex w-60 flex-col items-center rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
        >
          <Skeleton className="mb-4 h-12 w-12 rounded-xl" />
          <Skeleton className="mb-2 h-6 w-3/4" />
          <Skeleton className="h-7 w-10" />
        </div>
      ))}

      <div className="mt-2 flex w-full justify-center">
        <div className="flex w-60 flex-col items-center rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-12 w-12 rounded-xl" />
          <Skeleton className="mb-2 h-6 w-3/4" />
          <Skeleton className="h-7 w-10" />
        </div>
      </div>
    </div>
  );
}

export function UserSkelton() {
  return (
    <div className="flex items-center space-x-4 px-2.5">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px] max-w-[150px]" />
        <Skeleton className="h-4 w-[90px] max-w-[100px]" />
      </div>
    </div>
  );
}

export function TaskFormSkeletonLoader() {
  return (
    <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ViewClientDashboardSkeletonLoader() {
  return (
    <section className="flex h-full w-full flex-col space-y-6">
      <div className="w-full border-b border-black/20">
        <div className="mx-auto w-fit pb-3">
          <Skeleton className="h-7 w-56" />
        </div>
      </div>

      {/* Form area */}
      <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Categories and sub-services area */}
      <div className="h-full w-full gap-0 border-t border-black/10 pt-5">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex h-fit w-full flex-col gap-2.5 pb-10">
            <Skeleton className="h-6 w-48" />
            {[...Array(3)].map((_, j) => (
              <div
                key={j}
                className="rounded-xl border border-black/10 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SidebarSkeletonLoader() {
  return (
    <div className="gradientBg flex h-full w-full max-w-[200px] min-w-[100px] shrink-0 flex-col">
      {/* Header skeleton */}
      <div className="m-0 flex h-[92.81px] w-full justify-center border-b border-white/10">
        <Skeleton className="my-auto h-8 w-8 rounded-full" />
      </div>

      {/* Navigation items skeleton */}
      <div className="min-h-fit px-4 pt-[40.2px]">
        <div className="flex w-full flex-col gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="mt-auto pb-[30px]">
        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-px w-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function UploadFileSkeletonLoader() {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Dropzone */}
      <div className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <Skeleton className="mb-4 h-10 w-10 rounded-md" />
        <Skeleton className="mb-2 h-5 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Selected files list */}
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-32" />
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-sm" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded" />
      </div>

      {/* Actions */}
      <div className="flex w-full gap-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

// User form skeleton for profile/user editing screen
export function UserProfileFormSkeletonLoader() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-56 rounded-md" />
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>

          {/* Gender select */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <div className="relative w-full">
              <Skeleton className="h-12 w-full rounded-lg" />
              {/* Dropdown indicator */}
              <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                <Skeleton className="h-4 w-6 rounded" />
              </div>
            </div>
          </div>

          {/* Salary input with currency */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <div className="relative w-full">
              <Skeleton className="h-12 w-full rounded-lg" />
              <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex w-full justify-center pt-2">
            <Skeleton className="h-11 w-44 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClientFormSkeleton() {
  return (
    <section className="flex w-full flex-col items-center justify-center gap-y-6 py-8">
      {/* Form card */}
      <div className="w-full max-w-2xl rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          {/* Field 1 */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          {/* Field 2 */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          {/* Field 3 */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          {/* Field 4 */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          {/* Submit button */}
          <div className="flex w-full justify-center pt-2">
            <Skeleton className="h-11 w-40 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
