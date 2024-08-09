import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import {PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, decodePDFRawStream} from 'pdf-lib';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function extractEmbeddedXML(pdfArrayBuffer: ArrayBuffer) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer);

  const embeddedFiles = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('EmbeddedFiles'), PDFDict).lookup(PDFName.of('Names'), PDFArray);

  const rawAttachments = [];
  for (let idx = 0, len = embeddedFiles.size(); idx < len; idx += 2) {
      const fileName = embeddedFiles.lookup(idx);
      const fileSpec = embeddedFiles.lookup(idx + 1, PDFDict);
      rawAttachments.push({ fileName, fileSpec });
  }

  for (const file of rawAttachments) {
      const {fileSpec} = file;
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
              for(var i = 0; i < xml.childNodes.length; i++) {
                  var item = xml.childNodes.item(i);
                  var nodeName = item.nodeName;
                  if (typeof(obj[nodeName]) == "undefined") {
                      obj[nodeName] = xmlToJson(item);
                  } else {
                      if (typeof(obj[nodeName].push) == "undefined") {
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
      
      return jsonContent;
  }
}