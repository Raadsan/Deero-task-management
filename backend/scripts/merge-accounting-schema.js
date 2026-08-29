import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
const accountingSchemaPath = path.join(__dirname, "../../accounting-extracted/accounting-full-export/backend/prisma/schema.accounting.prisma");

let schemaContent = fs.readFileSync(schemaPath, "utf-8");
let accountingContent = fs.readFileSync(accountingSchemaPath, "utf-8");

// Clean up dangling relations in accountingContent
accountingContent = accountingContent
  .replace(/\s+order\s+order\[\]/g, "")
  .replace(/\s+order\s+order\?/g, "")
  .replace(/\s+purchases\s+purchase\[\]/g, "")
  .replace(/\s+addresses\s+address\[\]/g, "");

// Add relations to customers model in accounting
accountingContent = accountingContent.replace(
  /model customers \{([\s\S]*?)(@@unique)/m,
  (match, p1, p2) => {
    let body = p1;
    if (!body.includes("clientId")) {
      body = body + `  clientId              String?                @unique @db.VarChar(191)\n  client                Client?                @relation(fields: [clientId], references: [id], onDelete: SetNull)\n  quotations            quotations[]\n`;
    }
    return `model customers {${body}${p2}`;
  }
);

// Add relations to customer_invoices model in accounting
accountingContent = accountingContent.replace(
  /model customer_invoices \{([\s\S]*?)(@@unique)/m,
  (match, p1, p2) => {
    let body = p1;
    if (!body.includes("client_id")) {
      body = body + `  client_id             String?                @db.VarChar(191)\n  client                Client?                @relation(fields: [client_id], references: [id], onDelete: SetNull)\n  converted_quotations  quotations[]           @relation("QuotationToInvoice")\n`;
    }
    return `model customer_invoices {${body}${p2}`;
  }
);

// Additional Quotations and Document Templates models
const quotationAndTemplateModels = `

model quotations {
  id                    Int                 @id @default(autoincrement()) @db.UnsignedInt
  company_id            Int?                @db.UnsignedInt
  quotation_number      String              @unique @db.VarChar(32)
  client_id             String?             @db.VarChar(191)
  customer_id           Int?                @db.UnsignedInt
  date                  DateTime            @db.Date
  valid_until           DateTime?           @db.Date
  currency_id           Int?                @db.UnsignedInt
  status                quotation_status    @default(DRAFT)
  subtotal              Decimal             @default(0.00) @db.Decimal(15, 2)
  discount              Decimal             @default(0.00) @db.Decimal(15, 2)
  tax                   Decimal             @default(0.00) @db.Decimal(15, 2)
  total                 Decimal             @default(0.00) @db.Decimal(15, 2)
  notes                 String?             @db.Text
  terms                 String?             @db.Text
  converted_invoice_id  Int?                @db.UnsignedInt
  created_at            DateTime            @default(now()) @db.Timestamp(0)
  updated_at            DateTime            @default(now()) @db.Timestamp(0)
  
  lines                 quotation_lines[]
  client                Client?             @relation(fields: [client_id], references: [id], onDelete: SetNull)
  customer              customers?          @relation(fields: [customer_id], references: [id], onDelete: SetNull)
  converted_invoice     customer_invoices?  @relation("QuotationToInvoice", fields: [converted_invoice_id], references: [id], onDelete: SetNull)
  
  @@index([client_id])
  @@index([customer_id])
  @@index([status])
}

model quotation_lines {
  id                Int               @id @default(autoincrement()) @db.UnsignedInt
  quotation_id      Int               @db.UnsignedInt
  sequence          Int               @default(10) @db.UnsignedInt
  product_id        Int?              @db.UnsignedInt
  description       String            @db.VarChar(255)
  quantity          Decimal           @default(1.0000) @db.Decimal(15, 4)
  unit_price        Decimal           @default(0.0000) @db.Decimal(15, 4)
  discount_percent  Decimal           @default(0.0000) @db.Decimal(7, 4)
  tax_id            Int?              @db.UnsignedInt
  subtotal          Decimal?          @db.Decimal(15, 2)
  
  quotation         quotations        @relation(fields: [quotation_id], references: [id], onDelete: Cascade)
  products          products?         @relation(fields: [product_id], references: [id], onDelete: NoAction)
  taxes             taxes?            @relation(fields: [tax_id], references: [id], onDelete: NoAction)
  
  @@index([quotation_id])
  @@index([product_id])
  @@index([tax_id])
}

enum quotation_status {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
  EXPIRED
  CONVERTED
}

model document_templates {
  id                 Int              @id @default(autoincrement()) @db.UnsignedInt
  name               String           @db.VarChar(128)
  type               String           @db.VarChar(32)
  file_url           String?          @db.Text
  html_content       String?          @db.LongText
  is_default         Boolean          @default(false)
  placeholders       Json?
  created_at         DateTime         @default(now()) @db.Timestamp(0)
  updated_at         DateTime         @default(now()) @db.Timestamp(0)
}
`;

// Append to schemaContent if not already present
if (!schemaContent.includes("model chart_of_accounts")) {
  schemaContent = schemaContent.trim() + "\n\n" + accountingContent.trim() + "\n" + quotationAndTemplateModels.trim() + "\n";
  fs.writeFileSync(schemaPath, schemaContent, "utf-8");
  console.log("Successfully merged accounting models into schema.prisma");
} else {
  console.log("schema.prisma already contains accounting models");
}
