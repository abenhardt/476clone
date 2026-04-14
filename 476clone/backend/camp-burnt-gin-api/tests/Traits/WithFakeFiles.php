<?php

namespace Tests\Traits;

use Illuminate\Http\UploadedFile;

/**
 * WithFakeFiles — helpers for creating UploadedFile instances whose magic bytes
 * satisfy the finfo-based MIME validation in FileUploadService.
 *
 * Laravel's UploadedFile::fake()->create() generates files with arbitrary content,
 * but FileUploadService uses PHP's finfo extension to read actual magic bytes for
 * MIME detection (not just the client-supplied Content-Type header). A fake file
 * without valid magic bytes will be rejected with a 422.
 *
 * These helpers write minimal valid headers so finfo returns the expected MIME type.
 */
trait WithFakeFiles
{
    /**
     * Create a minimal PDF UploadedFile whose magic bytes pass finfo detection.
     *
     * The minimum valid PDF is %PDF- in the first five bytes. The rest is inert.
     */
    protected function fakePdf(string $name = 'test.pdf', int $sizeKb = 50): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'cbg_test_');
        // Minimal PDF-1.4 header — finfo detects this as application/pdf
        file_put_contents(
            $tmp,
            "%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n"
            ."2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n"
            ."3 0 obj\n<</Type/Page/MediaBox[0 0 612 792]>>\nendobj\n"
            ."xref\n0 4\n0000000000 65535 f\n"
            ."trailer\n<</Size 4/Root 1 0 R>>\nstartxref\n9\n%%EOF\n"
            .str_repeat('x', max(0, $sizeKb * 1024 - 200))
        );

        return new UploadedFile($tmp, $name, 'application/pdf', null, true);
    }

    /**
     * Create a minimal JPEG UploadedFile whose magic bytes pass finfo detection.
     *
     * JPEG magic bytes: FF D8 FF E0 (SOI + APP0 marker).
     */
    protected function fakeJpeg(string $name = 'test.jpg', int $sizeKb = 20): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'cbg_test_');
        file_put_contents(
            $tmp,
            "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            .str_repeat("\x00", max(0, $sizeKb * 1024 - 18))
        );

        return new UploadedFile($tmp, $name, 'image/jpeg', null, true);
    }
}
