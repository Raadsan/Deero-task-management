import { getClientById } from "@/lib/actions/client.action";
import ClientForm from "./ClientForm";
import EditClientCategory from "./EditClientCategory";

interface Props {
  params: Promise<Record<string, string>>;
}
export default async function ViewCLientDashboard({ params }: Props) {
  const { id } = await params;
  const { data: currentClient } = await getClientById(id);

  return (
    <section className="flex h-full w-full flex-col space-y-6">
      <div className="w-full border-b border-black/20">
        <h2 className="mx-auto w-fit pb-3 text-2xl font-bold">
          Basic Information
        </h2>
      </div>
      <ClientForm currentClient={currentClient} formType="edit" />
      <div className="h-full w-full gap-0 border-t border-black/10 pt-5">
        {currentClient?.service.map(({ id, serviceName }, index) => {
          const usedSubServices = currentClient.subServices.filter(
            (sub) => sub.categoryId === id,
          );

          if (!usedSubServices.length) return;

          return (
            <div
              key={index}
              className="flex h-fit w-full flex-col gap-2.5 pb-10"
            >
              <h2 className="text-2xl font-bold">{serviceName}</h2>
              {usedSubServices.map(
                (
                  {
                    id: subServiceId,
                    name,
                    createdAt,
                    count,
                    base,
                    description,
                    agreementId,
                  },
                  subIndex,
                ) => (
                  <EditClientCategory
                    agreementId={agreementId}
                    createdAt={createdAt}
                    base={base}
                    description={description}
                    count={count}
                    key={subIndex}
                    subServiceId={subServiceId}
                    defaultValue={name}
                    labelId={name}
                    placeholder={"Select Sub Category"}
                    categoryId={id}
                  />
                ),
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
