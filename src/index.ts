import { start } from "@clinq/bridge";
import { config } from "dotenv";
import { OutlookAdapter } from "./OutlookAdapter";

config();

start(new OutlookAdapter());
