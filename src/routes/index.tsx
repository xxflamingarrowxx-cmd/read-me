import { createFileRoute } from "@tanstack/react-router";
import { ReadMeApp } from "@/components/readme/read-me-app";

export const Route = createFileRoute("/")({ component: ReadMeApp });
