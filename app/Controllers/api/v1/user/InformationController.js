const { Mongoose } = require("mongoose");
const CMS = require("../../../../Models/Cms");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const bcrypt = require("bcrypt");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../../../helper/helper");
const {
  sendNotification,
  sendNewNotification,
  makeApiCall,
} = require("../../../../../helper/commonHelper");
const FAQ = require("../../../../Models/Faq");
const {
  failedValidation,
  response,
} = require("../../../../../helper/response");
const nodemailer = require("nodemailer");
const mail = require("../../../../../helper/mail");
const { decrypter } = require("../../../../../helper/crypto");
const { Validator } = require("node-input-validator");
const base64js = require("base64-js");
const QRCode = require("qrcode");
const encodedString =
  "AQVsdWNreQIPMzAwMDc1NTg4NzAwMDAzAxQyMDI0LTA3LTEzVDE0OjMxOjQ4WgQFMTEuNTIFBDEuOTIGLFpRclZ0TVBWT3lvWXFZSnVzdnRPOW1YazRmVWRiazVhUXFCVHBIVThTK1E9B2BNRVVDSUErakR6RGU0bVJvTTg3RXNiaEEyQmZiTm5BSDR5MU02QjdxSTlPQ1RBcWhBaUVBNE1uMXVsSGJONEV0MUREanRwOGJkbDZMSm5odEk1OWQ1d1NVeDJDU0NFbz0IWDBWMBAGByqGSM49AgEGBSuBBAAKA0IABNMAr2WtNWSj2uSrplhxz0cNFk/hv1LjMDgqbthcn6ydNWEuTNTQeyZJf1SfyMOFFM4cMpp+3wL+65Rj3fi+4w0JSDBGAiEAlcAzHKujzvjHJrAV1M/79RnYRqe66kmtgMUykr/N/CACIQDgTQwbfftw0pYo6FX8c63Q4edvFgt+7JhHaBlla0qRtQ==";
const decodedBytes = base64js.toByteArray(encodedString);
// Parse function for ZATCA QR code data
function parseZatcaQrCode(decodedBytes) {
  let index = 0;
  const parsedData = {};

  while (index < decodedBytes.length) {
    const tag = decodedBytes[index];
    const length = decodedBytes[index + 1];
    const value = new TextDecoder().decode(
      decodedBytes.slice(index + 2, index + 2 + length)
    );

    switch (tag) {
      case 1:
        parsedData["Seller Name"] = value;
        break;
      case 2:
        parsedData["VAT Registration Number"] = value;
        break;
      case 3:
        parsedData["Invoice Date"] = value;
        break;
      case 4:
        parsedData["Total Amount"] = value;
        break;
      case 5:
        parsedData["VAT Amount"] = value;
        break;
      case 6:
        parsedData["Signature"] = value;
        break;
      case 7:
        parsedData["Public Key"] = value;
        break;
      default:
        break;
    }

    index += 2 + length;
  }

  return parsedData;
}
module.exports = {
  //**********Faq list*********** /
  faqList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const v = new Validator(requests, {
        userType: "required|in:bidder,seller",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
      console.log({ requests });
      let faq = await FAQ.find(
        {
          user_type: requests.userType,
        },
        {
          title: 1,
          description: 1,
        }
      );
      const newData = {
        data: faq,
      };
      return response(res, 200, "Faq list", newData);
    } catch (err) {
      console.log({ err });
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },

  // Terms
  terms: async (req, res) => {
    try {
      const userType = req.query.userType;

      // Check if userType is missing
      if (!userType) {
        return failed(res, "userType is required");
      }

      const data = await CMS.findOne({
        type: "terms",
        userType,
      });

      if (!data) {
        return failed(
          res,
          "Terms & Condition not found for the specified user type"
        );
      }

      res.render("terms", {
        content: data.description,
      });
    } catch (err) {
      console.log(err);
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },

  // About
  about: async (req, res) => {
    try {
      const userType = req.query.userType;

      // Check if userType is missing
      if (!userType) {
        return failed(res, "userType is required");
      }

      const data = await CMS.findOne({
        type: "about",
        userType: userType,
      });

      if (!data) {
        return failed(res, "policy not found for the specified user type");
      }

      res.render("about", {
        content: data ? data.description : "No content",
      });
    } catch (err) {
      console.log(err);
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },

  // Policy
  policy: async (req, res) => {
    try {
      const userType = req.query.userType;

      // Check if userType is missing
      if (!userType) {
        return failed(res, "userType is required");
      }

      const data = await CMS.findOne({
        type: "privacy",
        userType,
      });

      if (!data) {
        return failed(res, "policy not found for the specified user type");
      }

      res.render("policy", {
        content: data.description,
      });
    } catch (err) {
      console.log(err);
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },
  // Data Privacy
  cancelPolicy: async (req, res) => {
    try {
      const data = await CMS.findOne({
        type: "cancelPolicy",
      });

      if (!data) {
        return failed(
          res,
          "canellation policy not found for the specified user type"
        );
      }

      res.render("canelPolicy", {
        content: data.description,
      });
    } catch (err) {
      console.log(err);
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },
  sendNotifcation: async (req, res) => {
    try {
      const { title, message } = req.body;
      let users;
      console.log("##########", req.body);
      const userId = "6668864bc8a00935966356f8";
      await sendNewNotification(userId, title, message);
      return success(res, "Notification send successfully.");
    } catch (error) {
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },

  testData: async (req, res) => {
    try {
      // Parse the decoded bytes
      const parsedData = parseZatcaQrCode(decodedBytes);
      console.log(parsedData);

      // Create QR code
      const qrData = JSON.stringify(parsedData);

      QRCode.toFile(
        "zatca_qr_code.png",
        qrData,
        {
          errorCorrectionLevel: "L",
        },
        function (err) {
          if (err) {
            console.error(err);
            throw err;
          }
          console.log("QR code generated and saved as zatca_qr_code.png");
          res
            .status(200)
            .send("QR code generated and saved as zatca_qr_code.png");
        }
      );
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  },

  makeTest: async (req, res) => {
    try {
      const tokenResponse = await makeApiCall(
        "https://api.complyance.io/test/auth-api/v1/proto/signIn",
        "post",
        {
          "Content-Type": "application/json",
        },
        JSON.stringify({
          refreshToken:
            "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.lJmYRAUgfWW20HuYeyATFNd83afBBSr1atC0D-dHdKi-n9p6oB8MLpHagEnPMc0YW86Jq8Qi6H_u8tVe99k86i1O44EedlzRC5YoywFZzRrn-EHkOypZSzBsXxtSUzEO4BIVUQUQ4Nh_Q6zGMi3ZRlLKqJK1S1t_iCdJEjWK2gBcM60Q_WhLbG3dlOC2_JvnYyf9w0HXI7NnwDBufTrwDEeKSTtZW8RsPtWDKN_R1gxtUEbOCWqFX7CcCvH4t4Pl6ssyeTExpb90rCHY3IsCJ7tY5KRaaT3EDVORojBpFDmvGRV2zm7CrB1lSwhRU6veYrJh6L7RDkp_LR8k-4z81g.E9DmzhQ92x6oIO6O.9rExEq0qOdyQDFZ7BkyiTGikKdR5ocU9oI1_Dwfa0Bnm_O1mC8TF_Gzh7i51u1jMQsYTZjeMqIfW_-V7QBPAMuZGl3k3R0_WaZdQLGbRgxNqUof8yZN0e6yov_f67w_b2Gse0YpBhDRZLG0Ww3N2i0iK7eqtpmaRjVxTzIepvSOAciNrpWlHvhBnn9kwvQabb6XP7vh9PdqfErQAIfsmZY6ltZPIrSbGBKObSVh5LkPwoKUiw1S4Q692-rUMrse7YZc-T3EhKYNkANgz-OXyM_ivYekUrE6_8SwHRGHBmiykD3hOx0fiWxvIqtBha4-ycGVfQkmXmIYgn0sk-8rXsXJCJ8Usvg-wAFOM95OTLCbobSylbVhkLi5700RF00q5K-YbqFj9K7FB_8nbRoZidQM-kTxgI9-XAfYpNg4T8SA0x5Wz5KY-FnnbHYofRrtRujUuAyBe-3qRdDBWrFwXhhovmvBVxJA71XuIkW7kND_T3nBMd-vM5eq8Hi5Lqvnff6HztwJuCtH4R_yfu7NSgpcYTx3nsX56GwdhjEdUkxfNvpbMY4wsuNxVAy75lwIB_De6pAxQixwZ_QNqcNLCvo1c3mTSKGBOnXbElzQaNzsy9A-mR7weAg4HC095A4ojSyRXiJw20fmOIHeLT7PRTbCPOht3hyDVvjK7CoWvKZ82JaRW30j_0AAQ2cASiVyXMGclFGcvrVOxPuYoDb7hb129AQ7ZpqXGbklfpcO9C-HeqZB_2duITmSweRmtPIXiu3R2PCBJPsmBM1ilZwCxEFqPTY5unRj3PafNgPtZpIY5jX2FIiOqgAT0S-NbRqCLuAspwUrZpWjbz7WO_KuIZinwdmvUIiDyJdpAyyxtljwY_7-Ngof7lfFF-SZOd38W4yFO6Gfr52SyrQaWBmW-rJUQ6oX7ak1X0gaqmjrmqMYAwjpgtr_bcxqZ3twROiv9svStV2lS_qZoi2Is8qV7LS-cpS63ZhTlPSn3A_iLZiljqURjAyBRdww6O2tUerb_IRgvABR4J7Hb1NMIBdUuAduqzKjLIc8KOg0nhSsO5DIIv9pbNAedHsXNbIzk8Mt5B3q-M_MXrwjhWbDau3MW1NPWqIdUkbiCSy66d_-boGCaJ2a1LuIRsSL2pvbrKHClaA8CvEjU-9B7292-AFhsinCqlICxjtN55cAdoscE7-dLnqD_Vm494FGlxD0x-EEkYvymtv0Wh4vlCQ3mxiJrv_P9--5uGx6FFVj4I3fk56YTDUHB7R-ALNDZtlZSIpoU6qhUkqZK_DrQc1QUM2o3wOBdlQxgdX03iQNR-7n6llrOTZFaKMKkUrGFUslzig.dPFy7bVbnD1_iloLcgGtQA",
        })
      );

      const accessToken = tokenResponse.accessToken;

      const qrCodeResponse = await makeApiCall(
        "https://api.complyance.io/test/api/v1/proto/generateQRCode",
        "post",
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        JSON.stringify({
          invoiceData: {
            documentType: "SIMPLIFIED_TAX_INVOICE",
            referenceId: "14",
            documentIssueDateTime: new Date(),
            sellerName: "sunil tiwari",
            sellerAddress: {
              addrLine1: "12, Masjid Street",
              addrLine2: "Amjad Building",
              additionalNo: "1234",
              buildingNumber: "1234",
              city: "Dammam",
              state: "Riyadh",
              zipCode: "12313",
              district: "Riyadh",
              country: "SA",
            },
            buyerName: "Zahid Gani",
            documentLineItems: [
              {
                lineItemDesc: "HP Laptop/Hp Laptop",
                lineItemPrice: 578.0,
                lineItemQty: 1.0,
                lineItemTaxableAmount: 578.0,
                discountOnLineItem: 0.0,
                vatRateOnLineItem: 15.0,
                lineItemVatAmount: 86.7,
                lineItemSubTotal: 664.7,
              },
            ],
            totalExcludingVat: 568.0,
            totalTaxableAmountExcludingVat: 578.0,
            vatTotal: 85.2,
            documentTotal: 653.2,
            discountOnDocumentTotal: 10.0,
            isSpecialBillingAgreement: "false",
            isTransactionType: "false",
            isSelfBilled: "false",
            isThirdParty: "false",
            isNominalSupply: "false",
            isExport: "false",
            isSummary: "false",
            supplyDate: "2022-12-30T09:58:24.000Z",
            sellerVatRegistrationNumber: "300055184400003",
            sellerGroupVatRegistrationNumber: "",
            additionalSellerIdType: "CRN",
            additionalSellerIdNumber: "",
            specialTaxTreatment: "0",
            currency: "SAR",
            paymentMeans: "OTHER",
            documentId: 146,
          },
        })
      );

      res.status(200).json({ qrCodeResponse });
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
  submitContactForm: async (req, res) => {
    try {
      console.log(req.body);
      let html;
      if (req.body.type === "contact") {
        html = `Your query submitted successfully.`;
      } else {
        html = `Subscribed User.`;
      }
      var mailData = {
        email: req.body.email.toLowerCase(),
        subject: "Green house",
        text: "",
        html: html,
      };

      try {
        await mail(mailData);
        res.status(200).json({ success: "Your query submitted successfully." });
      } catch (error) {
        console.error("Error:", error.message);
        res.status(400).json({ error: "Failed to send email." });
      }
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
};
