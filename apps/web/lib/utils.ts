import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, decodePDFRawStream } from 'pdf-lib';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const EURC = '0x5DA87d377dA16d940Ed992146397A454c625C410';

export interface OnchainInvoice {
  ID: string;
  date: {
    value: string;
    format: string;
  };
  typeCode: string;
  issuerAssignedID: string;
  buyerTradeParty: {
    name: string;
    specifiedLegalOrganizationID: {
      value: string;
      schemeID: string;
    };
  };
  sellerTradeParty: {
    name: string;
    postalTradeAddress: {
      countryID: string;
    }
    specifiedLegalOrganizationID: {
      value: string;
      schemeID: string;
    };
    specifiedTaxRegistrationID: {
      value: string;
      schemeID: string;
    };
  };
  tradeSettlement: {
    invoiceCurrencyCode: string;
    duePayableAmount: string;
    grandTotalAmount: string;
    taxBasisTotalAmount: string;
    taxTotalAmount: {
      value: string;
      currencyID: string;
    };
  }
}

export async function extractEmbeddedXML(pdfArrayBuffer: ArrayBuffer): Promise<OnchainInvoice | undefined> {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer);

  const embeddedFiles = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('EmbeddedFiles'), PDFDict).lookup(PDFName.of('Names'), PDFArray);

  const rawAttachments = [];
  for (let idx = 0, len = embeddedFiles.size(); idx < len; idx += 2) {
    const fileName = embeddedFiles.lookup(idx);
    const fileSpec = embeddedFiles.lookup(idx + 1, PDFDict);
    rawAttachments.push({ fileName, fileSpec });
  }

  for (const file of rawAttachments) {
    const { fileSpec } = file;
    const decoder = new TextDecoder('utf-8');
    const embeddedFileContent = fileSpec.lookup(PDFName.of('EF'), PDFDict)
      .lookup(PDFName.of('F'), PDFStream);

    const xmlContent = decoder.decode(decodePDFRawStream(embeddedFileContent as any).decode());
    // Parse XML content to JSON
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    function xmlToJson(xml: any) {
      // Create the return object
      var obj: any = {};

      if (xml.nodeType == 1) { // element
        // do attributes
        if (xml.attributes.length > 0) {
          obj["@attributes"] = {};
          for (var j = 0; j < xml.attributes.length; j++) {
            var attribute = xml.attributes.item(j);
            obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
          }
        }
      } else if (xml.nodeType == 3) { // text
        obj = xml.nodeValue;
      }

      // do children
      if (xml.hasChildNodes()) {
        for (var i = 0; i < xml.childNodes.length; i++) {
          var item = xml.childNodes.item(i);
          var nodeName = item.nodeName;
          if (typeof (obj[nodeName]) == "undefined") {
            obj[nodeName] = xmlToJson(item);
          } else {
            if (typeof (obj[nodeName].push) == "undefined") {
              var old = obj[nodeName];
              obj[nodeName] = [];
              obj[nodeName].push(old);
            }
            obj[nodeName].push(xmlToJson(item));
          }
        }
      }
      return obj;
    }

    const jsonContent = xmlToJson(xmlDoc);

    return {
      ID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:ExchangedDocument"]["ram:ID"]["#text"],
      date: {
        value: jsonContent["rsm:CrossIndustryInvoice"]["rsm:ExchangedDocument"]["ram:IssueDateTime"]["udt:DateTimeString"]["#text"],
        format: jsonContent["rsm:CrossIndustryInvoice"]["rsm:ExchangedDocument"]["ram:IssueDateTime"]["udt:DateTimeString"]["@attributes"].format
      },
      typeCode: jsonContent["rsm:CrossIndustryInvoice"]["rsm:ExchangedDocument"]["ram:TypeCode"]["#text"],
      issuerAssignedID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:BuyerOrderReferencedDocument"]["ram:IssuerAssignedID"]["#text"],
      buyerTradeParty: {
        name: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:BuyerTradeParty"]["ram:Name"]["#text"],
        specifiedLegalOrganizationID: {
          value: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:BuyerTradeParty"]["ram:SpecifiedLegalOrganization"]["ram:ID"]["#text"],
          schemeID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:BuyerTradeParty"]["ram:SpecifiedLegalOrganization"]["ram:ID"]["@attributes"].schemeID,
        }
      },
      sellerTradeParty: {
        name: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:SellerTradeParty"]["ram:Name"]["#text"],
        postalTradeAddress: {
          countryID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:SellerTradeParty"]["ram:PostalTradeAddress"]["ram:CountryID"]["#text"],
        },
        specifiedLegalOrganizationID: {
          value: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:SellerTradeParty"]["ram:SpecifiedLegalOrganization"]["ram:ID"]["#text"],
          schemeID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:SellerTradeParty"]["ram:SpecifiedLegalOrganization"]["ram:ID"]["@attributes"].schemeID
        },
        specifiedTaxRegistrationID: {
          value: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:SellerTradeParty"]["ram:SpecifiedTaxRegistration"]["ram:ID"]["#text"],
          schemeID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeAgreement"]["ram:SellerTradeParty"]["ram:SpecifiedTaxRegistration"]["ram:ID"]["@attributes"].schemeID
        }
      },
      tradeSettlement: {
        invoiceCurrencyCode: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeSettlement"]["ram:InvoiceCurrencyCode"]["#text"],
        duePayableAmount: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeSettlement"]["ram:SpecifiedTradeSettlementHeaderMonetarySummation"]["ram:DuePayableAmount"]["#text"],
        grandTotalAmount: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeSettlement"]["ram:SpecifiedTradeSettlementHeaderMonetarySummation"]["ram:GrandTotalAmount"]["#text"],
        taxBasisTotalAmount: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeSettlement"]["ram:SpecifiedTradeSettlementHeaderMonetarySummation"]["ram:TaxBasisTotalAmount"]["#text"],
        taxTotalAmount: {
          value: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeSettlement"]["ram:SpecifiedTradeSettlementHeaderMonetarySummation"]["ram:TaxTotalAmount"]["#text"],
          currencyID: jsonContent["rsm:CrossIndustryInvoice"]["rsm:SupplyChainTradeTransaction"]["ram:ApplicableHeaderTradeSettlement"]["ram:SpecifiedTradeSettlementHeaderMonetarySummation"]["ram:TaxTotalAmount"]["@attributes"].currencyID
        }
      }
    }
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
}

export async function base64ToFile(base64: string, fileName: string): Promise<File> {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
}

import { http, createConfig } from 'wagmi'
import { optimismSepolia } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [optimismSepolia],
  transports: {
    [optimismSepolia.id]: http(),
  },
})