<?php

declare(strict_types=1);

namespace App\Auth;

use RuntimeException;

/**
 * Thrown when a Google ID token or application JWT fails validation.
 */
final class InvalidTokenException extends RuntimeException
{
}
