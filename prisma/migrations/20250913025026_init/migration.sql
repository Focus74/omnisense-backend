-- CreateTable
CREATE TABLE "public"."Device" (
    "id" SERIAL NOT NULL,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RainReading" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rainfall_mm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RainReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Image" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeKB" INTEGER,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeatherCache" (
    "id" SERIAL NOT NULL,
    "latHash" TEXT NOT NULL,
    "lngHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_device_id_key" ON "public"."Device"("device_id");

-- CreateIndex
CREATE INDEX "RainReading_deviceId_timestamp_idx" ON "public"."RainReading"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "Image_deviceId_timestamp_idx" ON "public"."Image"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "WeatherCache_latHash_lngHash_idx" ON "public"."WeatherCache"("latHash", "lngHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."RainReading" ADD CONSTRAINT "RainReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Image" ADD CONSTRAINT "Image_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
