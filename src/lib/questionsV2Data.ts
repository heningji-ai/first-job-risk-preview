import questionsV2ConfigJson from "../config/questions_v2.json" with { type: "json" };
import type { QuestionsV2Config } from "../types/pathFitV2";

export const questionsV2Config = questionsV2ConfigJson as QuestionsV2Config;
export const questionsV2 = questionsV2Config.questions;
