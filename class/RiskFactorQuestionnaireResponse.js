const { identifierUrl } = require("../utils/heartcareSystemUrl");

class RiskFactorQuestionnaireResponse {
  constructor(answerObj, fhirResource) {
    this.fhirResource = fhirResource;
    this.answerObj = answerObj;
  }

  setBasicStructure() {
    this.fhirResource = {
      resourceType: "QuestionnaireResponse",
      identifier: {
        system: identifierUrl,
        value: this.answerObj.uuid,
      },
      status: "completed",
      questionnaire: this.answerObj.questionnaireId,
      encounter: { reference: "Encounter/" + this.answerObj.encounterId },
      author: {
        reference: "Practitioner/" + this.answerObj.practitionerId,
      },
      source: {
        reference: "Patient/" + this.answerObj.patientId,
      },
      authored: this.answerObj.appUpdatedDate,
      item:  [
        {
          linkId: "tobacco",
          text: "Tobacco Use",
          item: this.answerObj.tobacco == null ? null : [
            {
              linkId: "tobaccoUser",
              text: "Do you use tobacco products?",
              answer: [{ valueBoolean: this.answerObj.tobacco.tobaccoUser ?? null }],
            },
            {
              linkId: "tobaccoItemType",
              text: "Which tobacco product do you use the most?",
              answer: [{ valueInteger: this.answerObj.tobacco.tobaccoItemType ?? null }],
            },
            {
              linkId: "tobaccoOther",
              text: "Other tobacco (if any)",
              answer: [{ valueString: this.answerObj.tobacco.tobaccoOther ?? null }],
            },
            {
              linkId: "consumptionAmount",
              text: "On average, how many of the tobacco product above do you use each day?",
              answer: [{ valueInteger: this.answerObj.tobacco.consumptionAmount ?? null }],
            },
            {
              linkId: "consumptionUnit",
              text: "Unit",
              answer: [{ valueString: this.answerObj.tobacco.consumptionUnit ?? null }],
            },
            {
              linkId: "startAge",
              text: "How old were you when you first started using tobacco products?",
              answer: [{ valueInteger: this.answerObj.tobacco.startAge ?? null }],
            },
            {
              linkId: "willingToQuit",
              text: "Are you willing to make a quit attempt now?",
              answer: [{ valueBoolean: this.answerObj.tobacco.willingToQuit ?? null }],
            },
          ],
        },
        {
          linkId: "alcohol",
          text: "Alcohol Use",
          item: this.answerObj.alcohol == null ? null :  [
            {
              linkId: "consumedWithin30Days",
              text: "Have you consumed any alcohol in the past 30 days?",
              answer: [{ valueBoolean: this.answerObj.alcohol.consumedWithin30Days ?? null }],
            },
            {
              linkId: "alcoholQ1",
              text: "During the past 30 days, on how many occasions did you have at least one standard alcoholic drink?",
              answer: [{ valueInteger: this.answerObj.alcohol.alcoholQ1 ?? null }],
            },
            {
              linkId: "alcoholQ2",
              text: "During past 30 days, when you drank alcohol, how many standard drinks on average did you have during one drinking occasion?",
              answer: [{ valueInteger: this.answerObj.alcohol.alcoholQ2 ?? null }],
            },
            {
              linkId: "alcoholQ3",
              text: "During past 30 days, how many times did you have six or more standard drinks in a single drinking occasion?",
              answer: [{ valueInteger: this.answerObj.alcohol.alcoholQ3 ?? null }],
            },
          ],
        },
        {
          linkId: "fruitsVegetables",
          text: "Fruits and Vegetables",
          item: this.answerObj.fruitsVegetables == null ? null : [
            {
              linkId: "consumptionInWeek",
              text: "In a typical week do you eat any fruits or vegetables?",
              answer: [{ valueBoolean: this.answerObj.fruitsVegetables.consumptionInWeek ?? null }],
            },
            {
              test: "In a typical week, how many days do you eat fruits?",
              linkId: "fruitsDays",
              answer: [{ valueInteger: this.answerObj.fruitsVegetables.fruitsDays ?? null }],
            },
            {
              text: "How many servings of fruits do you eat on one of these days?",
              linkId: "fruitServings",
              answer: [{ valueInteger: this.answerObj.fruitsVegetables.fruitServings ?? null }],
            },
            {
              text: "In a typical week, how many days do you eat vegetables?",
              linkId: "vegetableDays",
              answer: [{ valueInteger: this.answerObj.fruitsVegetables.vegetableDays ?? null }],
            },
            {
              text: "How many servings of vegetables do you eat on one of these days?",
              linkId: "vegetableServings",
              answer: [{ valueInteger: this.answerObj.fruitsVegetables.vegetableServings ?? null }],
            },
          ],
        },
        {
          linkId: "physicalActivity",
          text: "Physical Activity",
          item: this.answerObj.physicalActivity == null ? null :[
            {
              text: "In a typical week, do you engage in any moderate to vigorous intensity activities (either as a part of work, travel to and from places or recreational activities) for at least 10 minutes continuously?",
              linkId: "weeklyEngagement",
              answer: [{ valueBoolean: this.answerObj.physicalActivity.weeklyEngagement ?? null }],
            },
            {
              text: "In a typical week, how many days do you do vigorous intensity activities (either as a part of work, travel to and from places or recreational activities)?",
              linkId: "vigorousDays",
              answer: [{ valueInteger: this.answerObj.physicalActivity.vigorousDays ?? null }],
            },
            {
              text: "How much time do you spend doing vigorous-intensity activity at work on a typical day?",
              linkId: "vigorousTime",
              answer: [{ valueInteger: this.answerObj.physicalActivity.vigorousTime ?? null }],
            },
            {
              text: "In a typical week, how many days do you do moderate intensity activities (either as a part of work, travel to and from places or recreational activities)?",
              linkId: "moderateDays",
              answer: [{ valueInteger: this.answerObj.physicalActivity.moderateDays ?? null }],
            },
            {
              text: "How much time do you spend doing moderate-intensity activity at work on a typical day?",
              linkId: "moderateTime",
              answer: [{ valueInteger: this.answerObj.physicalActivity.moderateTime ?? null }],
            },
          ],
        },
        {
          linkId: "salt",
          text: "Salt Consumption",
          item:  this.answerObj.salt == null ? null :[
            {
              text: "How much salt or salty sauce do you think you consume?",
              linkId: "saltAmount",
              answer: [{ valueInteger: this.answerObj.salt.saltAmount ?? null }],
            },
            {
              text: "How often do you add salt or a salty sauce such as soya sauce to your food right before you eat it or as you are eating it?",
              linkId: "saltAddMeal",
              answer: [{ valueInteger: this.answerObj.salt.saltAddMeal ?? null }],
            },
            {
              text: "How often is salt, a salty seasoning or a salty sauce added in cooking or preparing food in your household?",
              linkId: "saltAddCooking",
              answer: [{ valueInteger: this.answerObj.salt.saltAddCooking ?? null }],
            },
            {
              text: "How often do you eat processed food high in salt?",
              linkId: "saltProcessedFood",
              answer: [{ valueInteger: this.answerObj.salt.saltProcessedFood ?? null }],
            },
          ],
        },
        {
          linkId: "fatAndOil",
          text: "Fat and Oil",
          item:  this.answerObj.fatAndOil == null ? null :[
            {
              linkId: "oilUsed",
              text: "What type of oil or fat is most often used for meal preparation in your household?",
              answer: [{ valueInteger: this.answerObj.fatAndOil.oilUsed ?? null }],
            },
            {
              linkId: "fatFoodFrequency",
              text: "During the past 30 days, how many times per day did you usually eat food high in fat?",
              answer: [{ valueInteger: this.answerObj.fatAndOil.fatFoodFrequency ?? null }],
            },
             {
              linkId: "otherFatAndOils",
              text: "During the past 30 days, how many times per day did you usually eat food high in fat?",
              answer: [{ valueString: this.answerObj.fatAndOil.otherFatAndOils ?? null }],
            },
          ],
        },
        {
          linkId: "sugar",
          text: "Sugar Consumption",
          item: this.answerObj.sugar == null ? null :[
            {
              linkId: "softDrinkFrequency",
              text: "During the past 30 days, how many times per day did you usually drink carbonated soft drinks? Do not include diet soft drinks.",
              answer: [{ valueInteger: this.answerObj.sugar.softDrinkFrequency ?? null }],
            },
            {
              linkId: "juiceFrequency",
              text: "During the past 30 days, how many times per day did you usually drink fruit juice?",
              answer: [{ valueInteger: this.answerObj.sugar.juiceFrequency ?? null}],
            },
          ],
        },
        {
          linkId: "mealsOutsideHome",
          text: "Meals Outside Home",
          item: this.answerObj.mealsOutsideHome == null ? null :[
            {
              linkId: "eatsOut",
              text: "On average, how many meals per week do you eat that were not prepared at a home? By meal, I mean, breakfast, lunch or dinner.",
              answer: [{ valueBoolean: this.answerObj.mealsOutsideHome.eatsOut ?? null }],
            },
            {
              linkId: "mealsPerWeek",
              text: "Number of meals per week",
              answer: [{ valueInteger: this.answerObj.mealsOutsideHome.mealsPerWeek ?? null }],
            },
          ],
        },
      ] ,
    };
  }

  getFixedData() {
    this.answerObj = {
      fhirId: this.fhirResource.id,
      practitionerId: this.fhirResource.author.reference.split("/")[1],
      patientId: this.fhirResource.source.reference.split("/")[1],
      uuid: this.fhirResource.identifier.value,
      appUpdatedDate: this.fhirResource.authored,
    };
  }

  getData() {
    const tobacco = this.fhirResource.item[0]
    const alcohol = this.fhirResource.item[1]
    const fruitsVegetables = this.fhirResource.item[2]
    const physicalActivity = this.fhirResource.item[3]
    const salt = this.fhirResource.item[4]
    const fatAndOil = this.fhirResource.item[5]
    const sugar = this.fhirResource.item[6]
    const mealsOutsideHome = this.fhirResource.item[7]
    this.answerObj.tobacco = tobacco.item ?  {
      "tobaccoUser": tobacco.item[0].answer?.[0]?.valueBoolean ?? null ,
      "tobaccoItemType": tobacco.item[1].answer?.[0]?.valueInteger ?? null ,
      "tobaccoOther": tobacco.item[2].answer?.[0]?.valueString ?? null ,
      "consumptionAmount": tobacco.item[3].answer?.[0]?.valueInteger ?? null ,
      "consumptionUnit": tobacco.item[4].answer?.[0]?.valueString ?? null ,
      "startAge": tobacco.item[5].answer?.[0]?.valueInteger ?? null ,
      "willingToQuit": tobacco.item[6].answer?.[0]?.valueBoolean ?? null ,
  } : null,
  this.answerObj.alcohol =alcohol.item ? {
      "consumedWithin30Days": alcohol.item[0].answer?.[0]?.valueBoolean ?? null ,
      "alcoholQ1": alcohol.item[1].answer?.[0]?.valueInteger ?? null ,
      "alcoholQ2": alcohol.item[2].answer?.[0]?.valueInteger ?? null ,
      "alcoholQ3": alcohol.item[3].answer?.[0]?.valueInteger ?? null ,
  } : null,
  this.answerObj.fruitsVegetables = fruitsVegetables.item ?{
      "consumptionInWeek": fruitsVegetables.item[0].answer?.[0]?.valueBoolean ?? null ,
      "fruitsDays": fruitsVegetables.item[1].answer?.[0]?.valueInteger ?? null ,
      "fruitServings": fruitsVegetables.item[2].answer?.[0]?.valueInteger ?? null ,
      "vegetableDays": fruitsVegetables.item[3].answer?.[0]?.valueInteger ?? null ,
      "vegetableServings": fruitsVegetables.item[4].answer?.[0]?.valueInteger ?? null ,
  } : null,
  this.answerObj.physicalActivity = physicalActivity.item ?{
      "weeklyEngagement": physicalActivity.item[0].answer?.[0]?.valueBoolean ?? null ,
      "vigorousDays": physicalActivity.item[1].answer?.[0]?.valueInteger ?? null ,
      "vigorousTime": physicalActivity.item[2].answer?.[0]?.valueInteger ?? null ,
      "moderateDays": physicalActivity.item[3].answer?.[0]?.valueInteger ?? null ,
      "moderateTime": physicalActivity.item[4].answer?.[0]?.valueInteger ?? null ,
  } : null,
  this.answerObj.salt = salt.item ?{
      "saltAmount": salt.item[0].answer?.[0]?.valueInteger ?? null ,
      "saltAddMeal": salt.item[1].answer?.[0]?.valueInteger ?? null ,
      "saltAddCooking": salt.item[2].answer?.[0]?.valueInteger ?? null ,
      "saltProcessedFood": salt.item[3].answer?.[0]?.valueInteger ?? null ,
  } : null,
  this.answerObj.fatAndOil = fatAndOil.item ?{
      "oilUsed": fatAndOil.item[0].answer?.[0]?.valueInteger ?? null ,
      "fatFoodFrequency": fatAndOil.item[1].answer?.[0]?.valueInteger ?? null ,
      "otherFatAndOils": fatAndOil.item[2].answer?.[0]?.valueString ?? null ,
  } : null,
  this.answerObj.sugar = sugar.item ?{
      "softDrinkFrequency": sugar.item[0].answer?.[0]?.valueInteger ?? null ,
      "juiceFrequency": sugar.item[1].answer?.[0]?.valueInteger ?? null ,
  } : null,
  this.answerObj.mealsOutsideHome = mealsOutsideHome.item ?{
      "eatsOut":  mealsOutsideHome.item[0].answer?.[0]?.valueBoolean ?? null ,
      "mealsPerWeek": mealsOutsideHome.item[1].answer?.[0]?.valueInteger ?? null ,
  } : null
  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
  }
  getFHIRResource() {
    return this.fhirResource;
  }

  getFHIRToTransformedResult() {
    this.getFixedData();
    this.getData();
  }

  getSimplifiedOutput() {
    return this.answerObj;
  }
}

module.exports = RiskFactorQuestionnaireResponse;
