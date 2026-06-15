import { resolveSessionBranding } from "@/lib/actions/branch.action";
import { getUserSession } from "@/lib/actions/auth.action";
import {
  BranchBranding,
  getBranchThemeCssText,
  getBranchThemeStyle,
} from "@/lib/branch-branding";
import { BranchThemeProvider } from "./BranchThemeProvider";

type Props = {
  children: React.ReactNode;
  branding?: BranchBranding | null;
};

export default async function BranchThemeWrapper({ children, branding }: Props) {
  const resolved =
    branding !== undefined
      ? branding
      : await resolveSessionBranding(
          (await getUserSession()).data?.user,
        );
  const themeCss = getBranchThemeCssText(resolved);
  const themeStyle = getBranchThemeStyle(resolved);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `:root{${themeCss}}`,
        }}
      />
      <BranchThemeProvider branding={resolved}>
        <div className="h-full w-full" style={themeStyle}>
          {children}
        </div>
      </BranchThemeProvider>
    </>
  );
}
