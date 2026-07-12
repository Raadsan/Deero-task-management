import UploadUserDocumentsForm from "./UploadUserDocumentsForm";

interface Props {
  params: Promise<Record<string, string>>;
}
export default async function UploadFileWrapper({ params }: Props) {
  const { id } = await params;
  return <UploadUserDocumentsForm userId={id} />;
}
