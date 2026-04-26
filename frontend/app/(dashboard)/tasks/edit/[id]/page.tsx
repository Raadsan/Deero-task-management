import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { TaskFormSkeletonLoader } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import TaskformWrapper from "@/components/tasks/TaskformWrapper";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function EditTaskPage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText="Ediitng The Task"
        showBlurLine={false}
        showButton={false}
        classNames="text-white"
      />

      <div className="w-full px-[30px] py-[20px]">
        <PageBreadcrumb
          links={[
            {
              title: "Tasks",
              link: ROUTES.tasks,
            },
          ]}
        />
        <Suspense fallback={<TaskFormSkeletonLoader />}>
          <TaskformWrapper params={params} formType="edit" />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
