import type { RawLead } from "./types";
import type { AtsType, CompanyMeta } from "./types";
import { fetchGreenhouseBoard, fetchLeverBoard } from "./ats";
import { fetchAshbyBoard } from "./ashby";
import { fetchPage, stripHtml } from "./scrape";

export interface FortuneCompany {
  name: string;
  careersUrl: string;
  atsType: AtsType;
  atsSlug?: string;
  githubOrg?: string;
  linkedinSearchUrl?: string;
  website?: string;
}

/** Curated top tech employers — MAANG, unicorns, and popular brands. */
export const FORTUNE_COMPANIES: FortuneCompany[] = [
  // MAANG
  { name: "Meta", careersUrl: "https://www.metacareers.com/jobs", atsType: "custom", githubOrg: "facebook", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Meta&location=United%20States", website: "https://meta.com" },
  { name: "Apple", careersUrl: "https://jobs.apple.com/en-us/search", atsType: "custom", githubOrg: "apple", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Apple&location=United%20States", website: "https://apple.com" },
  { name: "Amazon", careersUrl: "https://www.amazon.jobs/en/search", atsType: "custom", githubOrg: "amzn", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Amazon&location=United%20States", website: "https://amazon.com" },
  { name: "Netflix", careersUrl: "https://jobs.netflix.com/", atsType: "lever", atsSlug: "netflix", githubOrg: "Netflix", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Netflix&location=United%20States", website: "https://netflix.com" },
  { name: "Google", careersUrl: "https://careers.google.com/jobs/results/", atsType: "custom", githubOrg: "google", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Google&location=United%20States", website: "https://google.com" },
  // Big tech
  { name: "Microsoft", careersUrl: "https://careers.microsoft.com/us/en/search-results", atsType: "custom", githubOrg: "microsoft", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Microsoft&location=United%20States", website: "https://microsoft.com" },
  { name: "Nvidia", careersUrl: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite", atsType: "workday", githubOrg: "NVIDIA", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Nvidia&location=United%20States", website: "https://nvidia.com" },
  { name: "Tesla", careersUrl: "https://www.tesla.com/careers/search/", atsType: "custom", githubOrg: "teslamotors", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Tesla&location=United%20States", website: "https://tesla.com" },
  { name: "Uber", careersUrl: "https://www.uber.com/us/en/careers/list/", atsType: "greenhouse", atsSlug: "uber", githubOrg: "uber", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Uber&location=United%20States", website: "https://uber.com" },
  { name: "Airbnb", careersUrl: "https://careers.airbnb.com/", atsType: "greenhouse", atsSlug: "airbnb", githubOrg: "airbnb", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Airbnb&location=United%20States", website: "https://airbnb.com" },
  { name: "Stripe", careersUrl: "https://stripe.com/jobs/search", atsType: "greenhouse", atsSlug: "stripe", githubOrg: "stripe", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Stripe&location=United%20States", website: "https://stripe.com" },
  { name: "Shopify", careersUrl: "https://www.shopify.com/careers", atsType: "lever", atsSlug: "shopify", githubOrg: "Shopify", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Shopify&location=United%20States", website: "https://shopify.com" },
  { name: "Spotify", careersUrl: "https://www.lifeatspotify.com/jobs", atsType: "greenhouse", atsSlug: "spotify", githubOrg: "spotify", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Spotify&location=United%20States", website: "https://spotify.com" },
  { name: "X", careersUrl: "https://careers.x.com/", atsType: "greenhouse", atsSlug: "twitter", githubOrg: "twitter", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Twitter&location=United%20States", website: "https://x.com" },
  { name: "Salesforce", careersUrl: "https://careers.salesforce.com/en/jobs/", atsType: "custom", githubOrg: "salesforce", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Salesforce&location=United%20States", website: "https://salesforce.com" },
  { name: "Adobe", careersUrl: "https://careers.adobe.com/us/en/search-results", atsType: "custom", githubOrg: "adobe", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Adobe&location=United%20States", website: "https://adobe.com" },
  { name: "Intel", careersUrl: "https://jobs.intel.com/en/search-jobs", atsType: "custom", githubOrg: "intel", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Intel&location=United%20States", website: "https://intel.com" },
  { name: "AMD", careersUrl: "https://careers.amd.com/careers-home/jobs", atsType: "custom", githubOrg: "AMD", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=AMD&location=United%20States", website: "https://amd.com" },
  { name: "IBM", careersUrl: "https://www.ibm.com/careers/search", atsType: "custom", githubOrg: "IBM", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=IBM&location=United%20States", website: "https://ibm.com" },
  { name: "Oracle", careersUrl: "https://careers.oracle.com/en/sites/jobsearch/jobs", atsType: "custom", githubOrg: "oracle", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Oracle&location=United%20States", website: "https://oracle.com" },
  { name: "Cisco", careersUrl: "https://jobs.cisco.com/jobs/SearchJobs", atsType: "custom", githubOrg: "CiscoSystems", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Cisco&location=United%20States", website: "https://cisco.com" },
  { name: "VMware", careersUrl: "https://careers.vmware.com/main/jobs", atsType: "custom", githubOrg: "vmware", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=VMware&location=United%20States", website: "https://vmware.com" },
  { name: "Snowflake", careersUrl: "https://careers.snowflake.com/us/en/search-results", atsType: "greenhouse", atsSlug: "snowflake", githubOrg: "snowflakedb", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Snowflake&location=United%20States", website: "https://snowflake.com" },
  { name: "Databricks", careersUrl: "https://www.databricks.com/company/careers/open-positions", atsType: "greenhouse", atsSlug: "databricks", githubOrg: "databricks", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Databricks&location=United%20States", website: "https://databricks.com" },
  { name: "Palantir", careersUrl: "https://jobs.lever.co/palantir", atsType: "lever", atsSlug: "palantir", githubOrg: "palantir", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Palantir&location=United%20States", website: "https://palantir.com" },
  { name: "Coinbase", careersUrl: "https://www.coinbase.com/careers/positions", atsType: "greenhouse", atsSlug: "coinbase", githubOrg: "coinbase", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Coinbase&location=United%20States", website: "https://coinbase.com" },
  { name: "Robinhood", careersUrl: "https://careers.robinhood.com/", atsType: "greenhouse", atsSlug: "robinhood", githubOrg: "robinhood", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Robinhood&location=United%20States", website: "https://robinhood.com" },
  { name: "DoorDash", careersUrl: "https://careers.doordash.com/", atsType: "greenhouse", atsSlug: "doordash", githubOrg: "doordash", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=DoorDash&location=United%20States", website: "https://doordash.com" },
  { name: "Instacart", careersUrl: "https://instacart.careers/current-openings/", atsType: "greenhouse", atsSlug: "instacart", githubOrg: "instacart", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Instacart&location=United%20States", website: "https://instacart.com" },
  { name: "Lyft", careersUrl: "https://www.lyft.com/careers", atsType: "lever", atsSlug: "lyft", githubOrg: "lyft", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Lyft&location=United%20States", website: "https://lyft.com" },
  { name: "Pinterest", careersUrl: "https://www.pinterestcareers.com/", atsType: "greenhouse", atsSlug: "pinterest", githubOrg: "pinterest", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Pinterest&location=United%20States", website: "https://pinterest.com" },
  { name: "Snap", careersUrl: "https://careers.snap.com/", atsType: "greenhouse", atsSlug: "snap", githubOrg: "Snapchat", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Snap&location=United%20States", website: "https://snap.com" },
  { name: "Reddit", careersUrl: "https://www.redditinc.com/careers", atsType: "greenhouse", atsSlug: "reddit", githubOrg: "reddit", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Reddit&location=United%20States", website: "https://reddit.com" },
  { name: "Discord", careersUrl: "https://discord.com/careers", atsType: "greenhouse", atsSlug: "discord", githubOrg: "discord", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Discord&location=United%20States", website: "https://discord.com" },
  { name: "Figma", careersUrl: "https://www.figma.com/careers/", atsType: "greenhouse", atsSlug: "figma", githubOrg: "figma", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Figma&location=United%20States", website: "https://figma.com" },
  { name: "Notion", careersUrl: "https://www.notion.so/careers", atsType: "ashby", atsSlug: "notion", githubOrg: "makenotion", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Notion&location=United%20States", website: "https://notion.so" },
  { name: "Canva", careersUrl: "https://www.canva.com/careers/", atsType: "greenhouse", atsSlug: "canva", githubOrg: "canva", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Canva&location=United%20States", website: "https://canva.com" },
  { name: "OpenAI", careersUrl: "https://openai.com/careers/search/", atsType: "greenhouse", atsSlug: "openai", githubOrg: "openai", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=OpenAI&location=United%20States", website: "https://openai.com" },
  { name: "Anthropic", careersUrl: "https://www.anthropic.com/careers", atsType: "greenhouse", atsSlug: "anthropic", githubOrg: "anthropics", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Anthropic&location=United%20States", website: "https://anthropic.com" },
  // Cloud & infra
  { name: "Cloudflare", careersUrl: "https://www.cloudflare.com/careers/jobs/", atsType: "ashby", atsSlug: "cloudflare", githubOrg: "cloudflare", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Cloudflare&location=United%20States", website: "https://cloudflare.com" },
  { name: "Vercel", careersUrl: "https://vercel.com/careers", atsType: "ashby", atsSlug: "vercel", githubOrg: "vercel", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Vercel&location=United%20States", website: "https://vercel.com" },
  { name: "Datadog", careersUrl: "https://careers.datadoghq.com/", atsType: "greenhouse", atsSlug: "datadog", githubOrg: "DataDog", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Datadog&location=United%20States", website: "https://datadoghq.com" },
  { name: "Twilio", careersUrl: "https://www.twilio.com/en-us/company/jobs", atsType: "greenhouse", atsSlug: "twilio", githubOrg: "twilio", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Twilio&location=United%20States", website: "https://twilio.com" },
  { name: "MongoDB", careersUrl: "https://www.mongodb.com/careers", atsType: "greenhouse", atsSlug: "mongodb", githubOrg: "mongodb", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=MongoDB&location=United%20States", website: "https://mongodb.com" },
  { name: "Elastic", careersUrl: "https://www.elastic.co/careers", atsType: "greenhouse", atsSlug: "elastic", githubOrg: "elastic", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Elastic&location=United%20States", website: "https://elastic.co" },
  { name: "HashiCorp", careersUrl: "https://www.hashicorp.com/careers", atsType: "greenhouse", atsSlug: "hashicorp", githubOrg: "hashicorp", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=HashiCorp&location=United%20States", website: "https://hashicorp.com" },
  { name: "GitLab", careersUrl: "https://about.gitlab.com/jobs/", atsType: "greenhouse", atsSlug: "gitlab", githubOrg: "gitlabhq", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=GitLab&location=United%20States", website: "https://gitlab.com" },
  { name: "GitHub", careersUrl: "https://github.com/careers", atsType: "custom", githubOrg: "github", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=GitHub&location=United%20States", website: "https://github.com" },
  { name: "Atlassian", careersUrl: "https://www.atlassian.com/company/careers/all-jobs", atsType: "greenhouse", atsSlug: "atlassian", githubOrg: "atlassian", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Atlassian&location=United%20States", website: "https://atlassian.com" },
  // Fintech & commerce
  { name: "Plaid", careersUrl: "https://plaid.com/careers/", atsType: "greenhouse", atsSlug: "plaid", githubOrg: "plaid", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Plaid&location=United%20States", website: "https://plaid.com" },
  { name: "Brex", careersUrl: "https://www.brex.com/careers", atsType: "greenhouse", atsSlug: "brex", githubOrg: "brexhq", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Brex&location=United%20States", website: "https://brex.com" },
  { name: "Ramp", careersUrl: "https://ramp.com/careers", atsType: "ashby", atsSlug: "ramp", githubOrg: "ramp", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Ramp&location=United%20States", website: "https://ramp.com" },
  { name: "Chime", careersUrl: "https://www.chime.com/careers/", atsType: "greenhouse", atsSlug: "chime", githubOrg: "chime", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Chime&location=United%20States", website: "https://chime.com" },
  { name: "Block", careersUrl: "https://block.xyz/careers", atsType: "greenhouse", atsSlug: "block", githubOrg: "square", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Block&location=United%20States", website: "https://block.xyz" },
  { name: "Affirm", careersUrl: "https://www.affirm.com/careers", atsType: "greenhouse", atsSlug: "affirm", githubOrg: "Affirm", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Affirm&location=United%20States", website: "https://affirm.com" },
  { name: "Klarna", careersUrl: "https://www.klarna.com/careers/", atsType: "greenhouse", atsSlug: "klarna", githubOrg: "klarna", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Klarna&location=United%20States", website: "https://klarna.com" },
  // Productivity & SaaS
  { name: "Asana", careersUrl: "https://asana.com/jobs", atsType: "greenhouse", atsSlug: "asana", githubOrg: "Asana", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Asana&location=United%20States", website: "https://asana.com" },
  { name: "Airtable", careersUrl: "https://airtable.com/careers", atsType: "greenhouse", atsSlug: "airtable", githubOrg: "Airtable", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Airtable&location=United%20States", website: "https://airtable.com" },
  { name: "Linear", careersUrl: "https://linear.app/careers", atsType: "ashby", atsSlug: "linear", githubOrg: "linear", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Linear&location=United%20States", website: "https://linear.app" },
  { name: "Dropbox", careersUrl: "https://www.dropbox.com/jobs", atsType: "greenhouse", atsSlug: "dropbox", githubOrg: "dropbox", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Dropbox&location=United%20States", website: "https://dropbox.com" },
  { name: "Box", careersUrl: "https://www.box.com/careers", atsType: "greenhouse", atsSlug: "box", githubOrg: "box", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Box&location=United%20States", website: "https://box.com" },
  { name: "Zoom", careersUrl: "https://careers.zoom.us/jobs", atsType: "greenhouse", atsSlug: "zoom", githubOrg: "zoom", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Zoom&location=United%20States", website: "https://zoom.us" },
  { name: "Slack", careersUrl: "https://slack.com/careers", atsType: "custom", githubOrg: "slackhq", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Slack&location=United%20States", website: "https://slack.com" },
  { name: "Rippling", careersUrl: "https://www.rippling.com/careers", atsType: "greenhouse", atsSlug: "rippling", githubOrg: "Rippling", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Rippling&location=United%20States", website: "https://rippling.com" },
  { name: "Gusto", careersUrl: "https://gusto.com/about/careers", atsType: "greenhouse", atsSlug: "gusto", githubOrg: "Gusto", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Gusto&location=United%20States", website: "https://gusto.com" },
  // Gaming & media
  { name: "Epic Games", careersUrl: "https://www.epicgames.com/site/en-US/careers/jobs", atsType: "greenhouse", atsSlug: "epicgames", githubOrg: "EpicGames", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Epic%20Games&location=United%20States", website: "https://epicgames.com" },
  { name: "Roblox", careersUrl: "https://careers.roblox.com/", atsType: "greenhouse", atsSlug: "roblox", githubOrg: "Roblox", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Roblox&location=United%20States", website: "https://roblox.com" },
  { name: "Unity", careersUrl: "https://unity.com/careers/positions", atsType: "greenhouse", atsSlug: "unity3d", githubOrg: "Unity-Technologies", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Unity&location=United%20States", website: "https://unity.com" },
  { name: "Twitch", careersUrl: "https://www.twitch.tv/jobs/en/", atsType: "custom", githubOrg: "twitchtv", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Twitch&location=United%20States", website: "https://twitch.tv" },
  // Other notable brands
  { name: "Wayfair", careersUrl: "https://www.aboutwayfair.com/careers", atsType: "greenhouse", atsSlug: "wayfair", githubOrg: "wayfair", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Wayfair&location=United%20States", website: "https://wayfair.com" },
  { name: "Zillow", careersUrl: "https://www.zillow.com/careers/", atsType: "greenhouse", atsSlug: "zillow", githubOrg: "zillow", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Zillow&location=United%20States", website: "https://zillow.com" },
  { name: "HubSpot", careersUrl: "https://www.hubspot.com/careers", atsType: "greenhouse", atsSlug: "hubspot", githubOrg: "HubSpot", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=HubSpot&location=United%20States", website: "https://hubspot.com" },
  { name: "Okta", careersUrl: "https://www.okta.com/company/careers/", atsType: "greenhouse", atsSlug: "okta", githubOrg: "okta", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Okta&location=United%20States", website: "https://okta.com" },
  { name: "CrowdStrike", careersUrl: "https://www.crowdstrike.com/careers/", atsType: "greenhouse", atsSlug: "crowdstrike", githubOrg: "CrowdStrike", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=CrowdStrike&location=United%20States", website: "https://crowdstrike.com" },
  { name: "ServiceNow", careersUrl: "https://careers.servicenow.com/", atsType: "custom", githubOrg: "ServiceNow", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=ServiceNow&location=United%20States", website: "https://servicenow.com" },
  { name: "Workday", careersUrl: "https://www.workday.com/en-us/company/careers.html", atsType: "custom", githubOrg: "Workday", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Workday&location=United%20States", website: "https://workday.com" },
  { name: "Splunk", careersUrl: "https://www.splunk.com/en_us/careers.html", atsType: "greenhouse", atsSlug: "splunk", githubOrg: "splunk", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Splunk&location=United%20States", website: "https://splunk.com" },
  { name: "Confluent", careersUrl: "https://careers.confluent.io/", atsType: "greenhouse", atsSlug: "confluent", githubOrg: "confluentinc", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Confluent&location=United%20States", website: "https://confluent.io" },
  { name: "Scale AI", careersUrl: "https://scale.com/careers", atsType: "greenhouse", atsSlug: "scaleai", githubOrg: "scaleapi", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Scale%20AI&location=United%20States", website: "https://scale.com" },
  { name: "Cohere", careersUrl: "https://cohere.com/careers", atsType: "ashby", atsSlug: "cohere", githubOrg: "cohere-ai", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Cohere&location=United%20States", website: "https://cohere.com" },
  { name: "Mistral AI", careersUrl: "https://mistral.ai/careers/", atsType: "custom", githubOrg: "mistralai", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Mistral&location=United%20States", website: "https://mistral.ai" },
  { name: "Hugging Face", careersUrl: "https://huggingface.co/jobs", atsType: "custom", githubOrg: "huggingface", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Hugging%20Face&location=United%20States", website: "https://huggingface.co" },
  { name: "Retool", careersUrl: "https://retool.com/careers", atsType: "ashby", atsSlug: "retool", githubOrg: "tryretool", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Retool&location=United%20States", website: "https://retool.com" },
  { name: "Mercury", careersUrl: "https://mercury.com/jobs", atsType: "ashby", atsSlug: "mercury", githubOrg: "mercurytechnologies", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Mercury&location=United%20States", website: "https://mercury.com" },
  { name: "Flexport", careersUrl: "https://www.flexport.com/careers/", atsType: "greenhouse", atsSlug: "flexport", githubOrg: "flexport", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Flexport&location=United%20States", website: "https://flexport.com" },
  { name: "Anduril", careersUrl: "https://www.anduril.com/careers/", atsType: "greenhouse", atsSlug: "andurilindustries", githubOrg: "anduril", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Anduril&location=United%20States", website: "https://anduril.com" },
  { name: "SpaceX", careersUrl: "https://www.spacex.com/careers/", atsType: "custom", githubOrg: "spacex", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=SpaceX&location=United%20States", website: "https://spacex.com" },
  { name: "TikTok", careersUrl: "https://careers.tiktok.com/", atsType: "custom", githubOrg: "tiktok", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=TikTok&location=United%20States", website: "https://tiktok.com" },
  { name: "ByteDance", careersUrl: "https://jobs.bytedance.com/en", atsType: "custom", githubOrg: "bytedance", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=ByteDance&location=United%20States", website: "https://bytedance.com" },
  { name: "Duolingo", careersUrl: "https://careers.duolingo.com/", atsType: "greenhouse", atsSlug: "duolingo", githubOrg: "duolingo", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Duolingo&location=United%20States", website: "https://duolingo.com" },
  { name: "Grammarly", careersUrl: "https://www.grammarly.com/careers", atsType: "greenhouse", atsSlug: "grammarly", githubOrg: "grammarly", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Grammarly&location=United%20States", website: "https://grammarly.com" },
  { name: "Calendly", careersUrl: "https://calendly.com/careers", atsType: "greenhouse", atsSlug: "calendly", githubOrg: "calendly", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Calendly&location=United%20States", website: "https://calendly.com" },
  { name: "Webflow", careersUrl: "https://webflow.com/careers", atsType: "greenhouse", atsSlug: "webflow", githubOrg: "webflow", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Webflow&location=United%20States", website: "https://webflow.com" },
  { name: "Miro", careersUrl: "https://miro.com/careers/", atsType: "greenhouse", atsSlug: "miro", githubOrg: "miroapp", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Miro&location=United%20States", website: "https://miro.com" },
  { name: "Loom", careersUrl: "https://www.loom.com/careers", atsType: "greenhouse", atsSlug: "loom", githubOrg: "loomhq", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Loom&location=United%20States", website: "https://loom.com" },
  { name: "Snyk", careersUrl: "https://snyk.io/careers/", atsType: "greenhouse", atsSlug: "snyk", githubOrg: "snyk", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=Snyk&location=United%20States", website: "https://snyk.io" },
  { name: "1Password", careersUrl: "https://1password.com/careers/", atsType: "greenhouse", atsSlug: "1password", githubOrg: "1Password", linkedinSearchUrl: "https://www.linkedin.com/jobs/search/?keywords=1Password&location=United%20States", website: "https://1password.com" },
];

/** Top 100 companies for focused scanning. */
export const TOP_FORTUNE_COMPANIES = FORTUNE_COMPANIES.slice(0, 100);

export const FORTUNE_COMPANY_NAMES = new Set(FORTUNE_COMPANIES.map((c) => c.name));

export const MAX_JOBS_PER_COMPANY = 50;

export function isJobFresh(postedAt: Date | undefined, maxAgeDays: number): boolean {
  if (!postedAt) return true; // unknown date — allow but score lower
  const ageMs = Date.now() - postedAt.getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

export function fortuneCompanyToMeta(co: FortuneCompany): CompanyMeta {
  return {
    careersUrl: co.careersUrl,
    atsType: co.atsType,
    githubOrg: co.githubOrg,
    linkedinSearchUrl: co.linkedinSearchUrl,
    website: co.website,
    greenhouseSlug: co.atsType === "greenhouse" ? co.atsSlug : undefined,
    leverSlug: co.atsType === "lever" ? co.atsSlug : undefined,
    ashbySlug: co.atsType === "ashby" ? co.atsSlug : undefined,
  };
}

function resolveUrl(href: string, base: string): string | null {
  try {
    if (href.startsWith("http")) return href;
    if (href.startsWith("//")) return `https:${href}`;
    if (href.startsWith("/")) return new URL(href, base).href;
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** Parse job links from custom careers HTML pages. */
export function parseCustomCareersPage(html: string, baseUrl: string, companyName: string): RawLead[] {
  const leads: RawLead[] = [];
  const seen = new Set<string>();
  const jobPatterns = /\/(jobs?|careers?|positions?|openings?|role|posting)/i;

  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const href = match[1];
    const text = stripHtml(match[2]);
    if (!text || text.length < 5 || text.length > 200) continue;
    if (!jobPatterns.test(href) && !/engineer|developer|manager|designer|analyst|scientist/i.test(text)) continue;

    const url = resolveUrl(href, baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    leads.push({
      title: text.slice(0, 300),
      url,
      source: "FORTUNE_CAREERS",
      companyName,
      description: undefined,
    });
    if (leads.length >= MAX_JOBS_PER_COMPANY) break;
  }

  return leads;
}

async function fetchCompanyJobs(co: FortuneCompany, maxAgeDays: number): Promise<RawLead[]> {
  const meta = fortuneCompanyToMeta(co);
  let jobs: RawLead[] = [];

  if (co.atsType === "greenhouse" && co.atsSlug) {
    const raw = await fetchGreenhouseBoard(co.atsSlug, co.name);
    jobs = raw.map((j) => ({ ...j, source: "FORTUNE_CAREERS" as const, companyMeta: meta }));
  } else if (co.atsType === "lever" && co.atsSlug) {
    const raw = await fetchLeverBoard(co.atsSlug, co.name);
    jobs = raw.map((j) => ({ ...j, source: "FORTUNE_CAREERS" as const, companyMeta: meta }));
  } else if (co.atsType === "ashby" && co.atsSlug) {
    const raw = await fetchAshbyBoard(co.atsSlug, co.name);
    jobs = raw.map((j) => ({ ...j, source: "FORTUNE_CAREERS" as const, companyMeta: meta }));
  } else {
    const html = await fetchPage(co.careersUrl);
    if (!html) {
      if (co.linkedinSearchUrl) {
        return [{
          title: `${co.name} — search openings on LinkedIn`,
          url: co.linkedinSearchUrl,
          source: "LINKEDIN",
          companyName: co.name,
          companyMeta: meta,
          description: `Careers page unavailable — use LinkedIn search for ${co.name} openings.`,
        }];
      }
      return [];
    }
    const parsed = parseCustomCareersPage(html, co.careersUrl, co.name);
    jobs = parsed.map((j) => ({ ...j, companyMeta: meta }));
  }

  return jobs
    .filter((j) => isJobFresh(j.postedAt, maxAgeDays))
    .slice(0, MAX_JOBS_PER_COMPANY);
}

/** Fetch jobs from top 100 curated Fortune/top-tech career pages. */
export async function fetchFortuneCareers(maxAgeDays = 45): Promise<RawLead[]> {
  const all: RawLead[] = [];
  const batchSize = 8;

  for (let i = 0; i < TOP_FORTUNE_COMPANIES.length; i += batchSize) {
    const batch = TOP_FORTUNE_COMPANIES.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((co) => fetchCompanyJobs(co, maxAgeDays)));
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value);
    }
  }

  return all;
}

export function getFortuneCompanyCount(): number {
  return FORTUNE_COMPANIES.length;
}
