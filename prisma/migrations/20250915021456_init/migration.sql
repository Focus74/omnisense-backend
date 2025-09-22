/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Image_deviceId_timestamp_idx";

-- DropIndex
DROP INDEX "public"."RainReading_deviceId_timestamp_idx";

-- DropIndex
DROP INDEX "public"."WeatherCache_latHash_lngHash_idx";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Device_updatedAt_idx" ON "public"."Device"("updatedAt");

-- CreateIndex
CREATE INDEX "Device_lat_lng_idx" ON "public"."Device"("lat", "lng");

-- CreateIndex
CREATE INDEX "Image_deviceId_timestamp_idx" ON "public"."Image"("deviceId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "RainReading_deviceId_timestamp_idx" ON "public"."RainReading"("deviceId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "WeatherCache_latHash_lngHash_provider_fetchedAt_idx" ON "public"."WeatherCache"("latHash", "lngHash", "provider", "fetchedAt" DESC);
